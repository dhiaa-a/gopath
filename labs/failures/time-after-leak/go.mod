module gopath.dev/labs/failures/time-after-leak

// Pinned to go 1.22 on purpose: the time.After leak this lab reproduces was
// fixed for modules declaring go 1.23+. The pin IS part of the lesson.
go 1.22
