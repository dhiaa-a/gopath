// Package util holds the string helpers the service layer needs.
//
// This file deliberately carries no build tag. Under -tags solution every
// other file in this directory is excluded, and a directory with zero Go
// files is not a package, so the build would fail before it reached the
// reference. Leave doc.go alone; the code you refactor is in util.go.
package util
