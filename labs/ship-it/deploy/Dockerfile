# The image. Two stages, and the only thing that survives into the second one
# is your binary.
#
#   docker build -f deploy/Dockerfile -t ship-it:dev \
#     --build-arg VERSION=$(git rev-parse --short HEAD) .
#   docker run --rm -p 8080:8080 ship-it:dev
#
# The -f points here, the final "." is the build context: COPY below resolves
# against the lab root, not against deploy/.
#
# Nothing in this lab's checks runs Docker. This file is yours to build and
# read; `check.sh` grades the Go program's shipping properties, not your
# container runtime.

# ─── build ──────────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS build
WORKDIR /src

# The module files first, on their own layer. Dependencies change far less
# often than your code does, so this layer gets cached and every later build
# skips the download. Copy everything at once instead and one edit to main.go
# re-downloads the world.
#
# This lab has no dependencies and so has no go.sum. A real service copies
# both: `go mod download` against a go.sum is reproducible, and without one it
# is a wish.
COPY go.mod ./
RUN go mod download

COPY . .

ARG VERSION=dev

# CGO_ENABLED=0 is the whole trick. With cgo on, the binary links against the
# libc of whatever machine built it, and glibc's name resolver dlopen()s more
# of itself at runtime, so a binary built here does not necessarily run there.
# With cgo off, Go uses its own DNS resolver and the output is one file that
# depends on nothing. That is what makes the second stage below possible at
# all.
#
#   -trimpath  strips your filesystem out of the binary: reproducible builds,
#              and stack traces that do not name /home/you/code.
#   -s -w      drop the symbol table and DWARF. Smaller, and undebuggable:
#              drop this pair the day you want to profile production.
#   -X         stamps VERSION into the variable named main.version.
RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/ship-it .

# ─── ship ───────────────────────────────────────────────────────────────────
# distroless/static is about 2MB and contains CA certificates, an /etc/passwd
# with a nonroot user, tzdata, and nothing else. No shell, no package manager,
# no curl, no libc. Most of an image's CVE list is software you never called;
# this is that list, deleted.
#
# FROM scratch is the purer version of the same idea and would run this binary
# fine today. You will want the CA roots the first time you call an HTTPS API,
# and an /etc/passwd the first time you want a non-root user that is not a
# bare UID, which is why static is the practical default.
#
# Pin by digest in a real service (static-debian12:nonroot@sha256:...). A tag
# is a moving target, and "it worked yesterday" is not a build system.
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/ship-it /ship-it

# The one variable that has to change to run in a container. The binary
# defaults to 127.0.0.1:8080, which inside a container means reachable only
# from inside that container's own network namespace: right on your laptop,
# useless here. Same binary, different network, one variable.
ENV SHIP_ADDR=:8080

# Documentation, not enforcement. EXPOSE publishes nothing by itself.
EXPOSE 8080

# Not root. This image's nonroot user is UID 65532.
USER nonroot:nonroot

# Exec form, so the binary is PID 1 and gets SIGTERM directly from the kernel.
# In shell form (ENTRYPOINT /ship-it) a shell is PID 1, and it does not
# forward signals: `docker stop` waits ten seconds for nothing to happen, then
# SIGKILLs the lot. That one bracket is the difference between the graceful
# shutdown you wrote and a graceful shutdown that never runs.
ENTRYPOINT ["/ship-it"]

# There is deliberately no HEALTHCHECK. It would need a shell or a curl, and
# this image has neither on purpose. The probes are HTTP endpoints because the
# thing that needs the answer is outside the container: Kubernetes calls them
# over the network (httpGet), which is also the only honest version of the
# question. A health check running inside the container cannot tell you the
# container is reachable.
