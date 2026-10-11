# The test bench

A fixed set of questions, the pictures this app makes for them, and a person's mark on each one.
It is how "are the pictures getting more accurate?" is answered with a number instead of a feeling.

- `cases/<id>.json` — one question: its script, the look its frames are drawn in, and the picture
  check's verdict on each diagram.
- `marks.json` — the marks, by case and by picture: `right`, `wrong` or `unrelated` (shown as
  *Beside the point*), with a note saying what is wrong. A mark `by: "claude"` is a suggestion and
  counts for nothing until a person presses a mark in the app.

Both are committed, so they travel with the code. The frames a person marks from are drawn into
`out/bench/<id>/` and are not — the **Accuracy** page draws them again on request.

Open the bench with **Accuracy** in the app's top bar. From a terminal:

    npm run bench

prints the score. See *Pictures that are checked, and the test bench* in `USER_GUIDE.md`.

A picture marked wrong is never removed to make the score look better. It is the standing test
that whatever let it through no longer does.
