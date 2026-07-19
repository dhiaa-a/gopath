import { Concept } from "../../content"

export const rateLimiting: Concept = {
	slug: "rate-limiting",
	name: "Rate limiting",
	tagline:
		"Depth is the burst you forgive, refill is the average you enforce. A token bucket is those two knobs, and in Go it is a buffered channel plus a ticker.",
	summary:
		"Unbounded demand meets a bounded server, and something has to give. A rate limiter decides what: it turns an arriving flood into a steady rate you chose. The token bucket is the canonical shape because it holds a long-run average without punishing a short burst. The machine model is small: a buffered channel holds tokens, a <code>time.Ticker</code> drops one in per interval, and a caller takes a token before doing work. Take succeeds and you proceed; the bucket is empty and you block or you are dropped. That is backpressure with a clock. The channel's capacity is the burst you tolerate and the ticker's interval is the average you hold, which is why a fixed <code>time.Sleep</code> between calls is not the same thing: it throws the burst away and serialises every caller through one waiting point.",
	mentalModel:
		"Picture a bucket a tap drips into at a fixed rate, one token per drip. Every request scoops one token out before it runs. When the bucket is full you can scoop several at once, which is the burst; once it is empty you can only scoop as fast as the tap drips, which is the average. Those are the two numbers and they are independent: the tap sets the sustained rate, the depth sets how large a clump of arrivals you forgive before the rate reasserts itself. In Go the bucket is a buffered channel and the tap is a <code>time.Ticker</code>: the ticker's goroutine does a non-blocking send on each tick, so when the bucket is full the token spills and is lost, which is exactly what caps the burst at the depth and stops idle time from banking into unbounded credit. A caller does a receive to take a token, blocking when the channel is empty. Nothing here is new machinery. It is a queue of permits and a clock that tops it up, and the whole reason it works is that the receive on an empty channel is the backpressure and the ticker is the only thing that relieves it.",
	retrievalPrompts: [
		"You replace your token-bucket limiter with a time.Sleep(50ms) at the top of each handler, reasoning that one call per 50ms is the same 20/second. A batch of 3 requests that used to clear instantly now takes 150ms. Why? || A fixed sleep has no bucket, so it has no burst: it spaces every call by 50ms whether or not any budget was idle. The token bucket started full, so the first 3 requests spend the 3 banked tokens with no wait and only the 4th onward pays the 50ms cadence. The sleep enforces the same average and destroys the burst, and worse, if the sleep sits in one shared goroutine or behind one mutex it serialises callers who could have run at once. Same rate, different latency shape, and the shape is the whole point of a bucket.",
		"Your limiter's refill goroutine does for { <-time.NewTicker(d).C; ... } and the service's memory climbs under churn. What did you build? || A new ticker every loop iteration, each one an entry in the runtime's timer heap that keeps firing forever because nothing stops it. time.NewTicker allocates a live timer the runtime holds a reference to; calling it inside the loop instead of once before it abandons a still-armed ticker every iteration, and none are collectable while they are running. Build the ticker once with t := time.NewTicker(d); defer t.Stop() and range t.C, so there is exactly one timer and it dies when the goroutine returns. The bug is not the limiter logic, it is treating a ticker like a value instead of a resource.",
		"You set a global limiter to 100/second with a depth of 100 to be safe, and one client still knocks the service over with a burst. Name the two things that went wrong. || First, a depth of 100 means 100 requests may arrive in the same millisecond before the rate even engages, so '100/second' is a fiction during any burst up to the depth: depth is how much you let the average be violated instantaneously, and 100 is enormous. Second, one global bucket cannot isolate one client, because every caller draws from the same tokens, so a single abuser spends the whole budget and starves everyone. The fix is a shallow depth sized to real concurrency, not to a round number, and a limiter per client key rather than per process. A limiter answers 'how fast, and per what', and the wrong 'per what' makes the 'how fast' meaningless.",
	],
	codeExample: `package main

import (
	"fmt"
	"time"
)

// A token-bucket limiter. The bucket is a buffered channel: its capacity is the
// burst depth, and every token sitting in it is one permit ready to spend right
// now. A ticker adds one token per interval, which is the long-run rate. A
// caller takes a token before doing work; Allow reports whether one was there.
type limiter struct {
	tokens chan struct{}
	stop   chan struct{}
}

func newLimiter(burst int, refill time.Duration) *limiter {
	l := &limiter{
		tokens: make(chan struct{}, burst),
		stop:   make(chan struct{}),
	}
	for i := 0; i < burst; i++ { // start full: the whole burst is available at t=0
		l.tokens <- struct{}{}
	}
	go l.refill(refill)
	return l
}

func (l *limiter) refill(every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop() // a ticker is an entry in the runtime timer heap; leak it and it fires forever
	for {
		select {
		case <-t.C:
			select { // non-blocking add: if the bucket is full, drop the token
			case l.tokens <- struct{}{}:
			default:
			}
		case <-l.stop:
			return
		}
	}
}

// Allow is the non-blocking question: is a permit free this instant?
func (l *limiter) Allow() bool {
	select {
	case <-l.tokens:
		return true
	default:
		return false
	}
}

// Wait is the blocking form: hold until a permit is free.
func (l *limiter) Wait() { <-l.tokens }

func (l *limiter) Close() { close(l.stop) }

func main() {
	// Burst of 3, one new token every 50ms: a steady 20 permits/sec with room
	// for 3 to leave at once.
	lim := newLimiter(3, 50*time.Millisecond)
	defer lim.Close()

	// Fire 8 requests back to back, far faster than the 50ms refill. The loop
	// finishes in microseconds, so no tick has landed: only the tokens the
	// bucket started with can be spent.
	allowed, throttled := 0, 0
	for i := 0; i < 8; i++ {
		if lim.Allow() {
			allowed++
		} else {
			throttled++
		}
	}
	fmt.Printf("burst of 8 at t=0:      %d allowed, %d throttled\\n", allowed, throttled)

	// Wait five whole intervals WITHOUT spending. A fixed sleep would let five
	// permits pile up; the bucket does not, because its full-check drops every
	// tick once depth is reached. So the next burst is still only 3.
	time.Sleep(250 * time.Millisecond)
	allowed, throttled = 0, 0
	for i := 0; i < 8; i++ {
		if lim.Allow() {
			allowed++
		} else {
			throttled++
		}
	}
	fmt.Printf("burst of 8 after 250ms: %d allowed, %d throttled\\n", allowed, throttled)

	// Now measure the sustained rate. The bucket is empty. One blocking Wait
	// syncs us to a tick boundary; from there four more Waits each cost exactly
	// one interval, so four permits take about four ticks: the average holds.
	lim.Wait()
	start := time.Now()
	for i := 0; i < 4; i++ {
		lim.Wait()
	}
	fmt.Printf("4 permits, drained:     %v (about 4 x 50ms)\\n",
		time.Since(start).Round(25*time.Millisecond))
}`,
	codeExplanation:
		"This prints three lines, and each is one property of the bucket.<br><br><code>burst of 8 at t=0:      3 allowed, 5 throttled</code><br><code>burst of 8 after 250ms: 3 allowed, 5 throttled</code><br><code>4 permits, drained:     200ms (about 4 x 50ms)</code><br><br>Line one is the burst: the bucket started full with 3 tokens, the 8-request loop runs in microseconds so no tick has landed, and exactly 3 requests find a token before the other 5 are throttled. Depth is the burst, made visible. Line two is the part people get wrong about token buckets. The program sleeps 250ms, five whole refill intervals, without spending anything, and the next burst of 8 still clears only 3. Five tokens did not accumulate, because the refill goroutine's send is non-blocking: once the bucket holds its depth of 3, every further tick finds the channel full and drops its token on the floor. Idle time does not bank into unbounded credit; the depth caps it. That single <code>select { case l.tokens &lt;- struct{}{}: default: }</code> is the whole difference between a token bucket and a counter that only ever grows. Line three measures the sustained rate. After draining the bucket, one blocking <code>Wait</code> syncs us to a tick boundary, then four more <code>Wait</code>s each block until the next tick, so four permits cost four intervals: <code>200ms</code>, the average holding at one per 50ms now that the burst is spent. The number is stable to the tick because the ticker reschedules against an absolute clock rather than accumulating drift, and the <code>Round(25*time.Millisecond)</code> absorbs the few milliseconds of Windows timer jitter; it printed <code>200ms</code> on all 13 runs here. On the Go Playground it is exact: the Playground's fake clock advances straight to each pending timer while the program is blocked, so the sleep and every tick land on precise multiples and you get the identical three lines. Now delete the <code>defer t.Stop()</code> in <code>refill</code> and the output does not change at all, which is the trap: this program exits immediately so the abandoned ticker is invisible, and in a long-lived service that builds limiters over time each leaked ticker keeps a timer live and firing forever.",
	designRationale:
		"Rate limiting is old, and the token bucket won because of a property the alternatives lack: it enforces an average while forgiving a burst, and real traffic is bursty. A fixed-window counter (allow N per calendar second, reset at the boundary) is trivial to write and has a notorious failure: a client can send N at 0.999s and N more at 1.001s, twice the intended rate across the boundary, because the counter remembers only the current window of wall-clock time and nothing of the recent past. The token bucket has no boundary because refill is continuous; the only burst it permits is the depth, and that burst is bounded and chosen, not an artifact of where the second happens to tick over. Go builds it from a buffered channel and a <code>time.Ticker</code> rather than shipping a primitive because the pieces already have exactly the right semantics. A receive on an empty channel blocks, and blocking is backpressure: the caller that cannot get a token is made to wait by the same mechanism that makes an unbuffered send wait for a receiver. A buffered channel's capacity is already a hard cap on how many tokens can sit waiting, which is the depth for free. And a ticker is the runtime's timer heap doing the refill on a schedule the scheduler already manages. The one line that turns this pile of primitives into a bucket rather than a queue is the non-blocking send, a <code>select</code> with a <code>default</code> so a tick into a full bucket is discarded. Without it, idle tokens would queue without bound and the 'limit' would become a promise to eventually allow an unlimited backlog, which is the opposite of a limit. The standard library deliberately does not put a rate limiter in <code>net/http</code> or anywhere in core, for the same reason it ships no default timeouts and no job queue: the right policy, how fast, per which key, block or drop, is application knowledge the library cannot guess, so it ships the primitives and lets you assemble the dozen lines. <code>golang.org/x/time/rate</code> exists for when you want a maintained, tested version with a proper <code>Wait(ctx)</code> that honours cancellation and supports fractional rates, and it is built from the same idea. The reason to hand-roll it once is that a limiter you assembled from a channel and a ticker is a limiter you can reason about when it misbehaves, and 'my limiter leaked memory' is almost always the ticker, which you can only see if you know it is there.",
	commonMistakes: [
		{
			title: "Creating the ticker inside the loop, or never stopping it",
			body: "<code>time.NewTicker</code> returns a live timer the runtime holds until you call <code>Stop</code>, so <code>for { &lt;-time.NewTicker(d).C }</code> abandons one armed ticker per iteration and every one keeps firing forever. Build it once above the loop, <code>defer t.Stop()</code> on the next line, and <code>range</code> its channel. A leaked ticker is invisible in a short program and a steady memory climb in a service that recreates limiters, and it is the single most common way this pattern goes wrong.",
		},
		{
			title: "Reaching for time.Sleep between calls instead of a bucket",
			body: "A <code>Sleep</code> at the top of each call enforces the same average and throws away everything else. There is no depth, so no burst: three requests that could have cleared at once are forced 50ms apart even when the budget was idle. And a sleep in one shared goroutine or behind one mutex serialises callers who should run concurrently. The bucket lets idle budget bank up to the depth and lets independent callers each take a token without queueing behind one another. Same rate, worse latency, less concurrency.",
		},
		{
			title: "Spawning a goroutine per allowed request and calling it limited",
			body: "The limiter caps the rate at which work is admitted, not the amount of work in flight. If each <code>Allow</code> that returns true launches a <code>go handle()</code> that runs for seconds, then at 100 admits/second with 10-second handlers you accumulate a thousand live goroutines, and the limiter did its job while the process still fell over. Rate and concurrency are different bounds: rate is admits per unit time, concurrency is how many run at once. If in-flight work is the risk, add a second bound, a semaphore channel of fixed capacity that a handler acquires and releases, sized to what the machine can actually run.",
		},
		{
			title: "One global bucket where you needed one per client",
			body: "A single process-wide limiter shares its tokens across every caller, so one abusive client drains the budget and starves everyone else while your dashboard shows the global rate holding perfectly. 'How fast' is only half a limiter; the other half is 'per what'. For fairness or per-tenant quotas, key a map of buckets by API key, IP, or account and limit each independently, with a cheap eviction so idle keys do not leak buckets. A global bucket is right only when you are rationing one shared downstream resource whose total capacity is the thing you are protecting.",
		},
		{
			title: "Setting the depth to a big round number",
			body: "The depth is how many requests may arrive in the same instant before the rate engages at all, so a depth of 1000 means your '100/second' limit permits a 1000-request spike that lands before any throttling happens. Depth is the amount by which you allow the average to be violated instantaneously, and it should be sized to the real concurrency you want to forgive, usually a handful, not to whatever number looked safe. Too deep and the limit is fiction during exactly the burst you built it to survive; too shallow, a depth of 1, and you have a fixed sleep again, with no tolerance for the normal clumping of real traffic.",
		},
	],
	relatedSlugs: ["buffered-channels", "time", "context", "select"],
}
