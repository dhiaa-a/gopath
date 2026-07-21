module gopath.dev/labs/failures/loop-capture

// Pinned to go 1.21 on purpose: this module reproduces the shared loop
// variable that Go 1.22 fixed. The pin IS part of the lesson.
go 1.21
