# Taskpiea
Taskpiea is a VSCode extension for managing tasks directly in plain text `.taskp` files.  
It provides syntax highlighting, code lens, and navigation for tasks, issues, users, and settings.
Tasks are created by users. Issues are generated from the code base using the scanner keywords.

"The land of endless possibilities lies above the clouds."

## EXAMPLE TASKP FILE

```md
[TASKS]
- create user settings page @bobby @vanessa [#DF87C]
    - provide multi language info @paul [#698DF]
- setup SQLite persistence [#54010]
- implement user authentication [#AE614]
- review this code [main.c::3] [#B9AF1]
    -- not sure if there is anything to fix, just want to review it
    // comments can be like this
    <!-- or like this -->

[ISSUES]
- // TODO: add error checking here [main.c::5]
- // BUG: the user obj can be null here [main.c::45]

[USERS]
- bobby
- vanessa
- paul

[SETTINGS]
Scanner.Keyword: TODO
Scanner.Keyword: BUGS
Scanner.Keyword: FIXME
Scanner.Exclude: someDirectory1
Scanner.Exclude: *.md