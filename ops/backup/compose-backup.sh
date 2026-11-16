#!/usr/bin/env bash
# A nightly backup for a village on ONE computer, started with docker-compose.yml
# (START_HERE.md, part A). Run it from cron. It takes the database, the uploads
# volume and your .env, and writes them as three files encrypted with YOUR public
# key, so a copied or stolen backup folder reads as noise.
#
# Which backup is this for?
#   One computer with docker compose  -> this script.
#   Railway or another host           -> that provider's database backups and
#                                        volume snapshots, plus ops/backup/db-backup.yml
#                                        run from a PRIVATE GitHub repository
#                                        (docs/RUNBOOK.md, "Where the backup runs").
#                                        That one needs a database reachable from the
#                                        internet, which the compose database is not.
#
# One-time setup:
#   1. Make a keypair on a machine that is NOT this server and keep the private
#      half offline. docs/RUNBOOK.md, "Where the backup runs", has the gpg commands.
#   2. Export only the PUBLIC half, and copy that file to this computer:
#        gpg --armor --export FINGERPRINT > backup-public.asc
#   3. Test it once by hand, then restore one backup somewhere to prove it works.
#   4. Schedule it (crontab -e), from the village's folder:
#        17 3 * * * cd /path/to/village && ./ops/backup/compose-backup.sh >> backups/backup.log 2>&1
#
# Settings (environment variables, all optional except the key):
#   BACKUP_GPG_PUBLIC_KEY_FILE  path to your public key. Default: ./backup-public.asc
#   BACKUP_DIR                  where backups go. Default: ./backups
#   BACKUP_KEEP_DAYS            delete backups older than this. Default: 14
#
# Copying the backup somewhere else is still your job: this script writes to this
# computer's disk, and one broken disk takes the backup with the village. Copy
# BACKUP_DIR to another machine or a storage service after each run (rsync, rclone).
# The .env copy it makes sits on the same disk too, so ALSO keep your .env in a
# password manager. The .env holds the keys the database is sealed and signed with.
set -euo pipefail
umask 077

KEY_FILE="${BACKUP_GPG_PUBLIC_KEY_FILE:-./backup-public.asc}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
HELPER_IMAGE="alpine:3.20"
VOLUME="village-os_village-data"
DATE="$(date +%F)"

command -v gpg >/dev/null || { echo "gpg is not installed (apt install gnupg)." >&2; exit 1; }
[ -s "$KEY_FILE" ] || {
  echo "No public key at $KEY_FILE. Refusing to write an unencrypted backup." >&2
  exit 1
}
[ -f .env ] || { echo "Run this from the village's folder: there is no .env here." >&2; exit 1; }
case "$KEEP_DAYS" in ''|*[!0-9]*) echo "BACKUP_KEEP_DAYS must be a whole number." >&2; exit 1 ;; esac

mkdir -p "$DIR"
work="$(mktemp -d "$DIR/.work.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# A throwaway keyring, so the key is not added to the server's own.
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --quiet --import "$KEY_FILE"
recipient="$(gpg --batch --with-colons --list-keys | awk -F: '$1 == "fpr" { print $10; exit }')"
[ -n "$recipient" ] || { echo "Could not read a key from $KEY_FILE." >&2; exit 1; }

encrypt() { # stdin -> $1, encrypted to the recipient. Written whole or not at all.
  gpg --batch --yes --quiet --trust-model always --recipient "$recipient" \
    --output "$1.partial" --encrypt && mv "$1.partial" "$1"
}

# The database. Fails loudly if the database container is not running.
docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --no-tablespaces village' \
  | gzip | encrypt "$DIR/village-$DATE.sql.gz.gpg"

# The uploaded photographs and documents.
docker run --rm -v "$VOLUME":/data:ro "$HELPER_IMAGE" tar czf - -C /data . \
  | encrypt "$DIR/uploads-$DATE.tar.gz.gpg"

# The keys. Without them a restored database cannot open what it stored.
encrypt "$DIR/env-$DATE.gpg" < .env

# A backup that is empty is worse than none: it looks like one.
for f in "village-$DATE.sql.gz.gpg" "uploads-$DATE.tar.gz.gpg" "env-$DATE.gpg"; do
  [ -s "$DIR/$f" ] || { echo "$f is empty. The backup failed." >&2; exit 1; }
done

find "$DIR" -maxdepth 1 -type f \( -name 'village-*.gpg' -o -name 'uploads-*.gpg' -o -name 'env-*.gpg' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) backup $DATE written to $DIR. Copy it off this computer, and keep your .env in a password manager."
echo "To restore: gpg --decrypt FILE.gpg > FILE (on the machine that holds the private key), then follow START_HERE.md, Backups."
