# The window

> Full screen, always on top, and how that differs on each operating system.

The app does **not** use native fullscreen, deliberately. On macOS a
native-fullscreen app gets its own Space, and a three-finger swipe slides
straight past it to the desktop.

Instead the window is frameless, fixed, sized to the whole display, and kept at
`screen-saver` level so it sits above the Dock and menu bar. On macOS it also
joins every Space, so swiping brings the window along rather than revealing
what is behind it.

A site that asks for fullscreen with its own button still gets it. The bar
slides away and **Esc** brings it back.