# Spanish fragments

A pull request never edits `../es.po`. It adds its Spanish here, as
`<name>.po`: an ordinary PO file holding only the entries it adds or changes,
each with `msgctxt` and `msgid` copied from `../en.po`, and a
`# needs-native-review: <what>, <date>` line above each one.

Main folds every fragment into `es.po` after the merge and deletes it
(`scripts/fold-po-fragments.mjs`). Until then the build, the catalog check and
the coverage measure read `es.po` with these folded in. The rules are in
`docs/I18N.md` and `docs/GENERATED_DOCS.md`.
