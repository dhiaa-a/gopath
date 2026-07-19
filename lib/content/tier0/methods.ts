import { Tier0Lesson } from "../../content"

export const methods: Tier0Lesson = {
	slug: "methods",
	order: 8,
	title: "Methods and receivers",
	tagline: "Functions attached to types, and the copy trap that isn't a trap once you see it.",
	estimatedMinutes: 15,
	intro: [
		{
			type: "text",
			value: {
				en: "A method is a function with a receiver: a special first parameter written before the name. <code>func (c Counter) Value() int</code> attaches <code>Value</code> to the <code>Counter</code> type, called as <code>c.Value()</code>. Methods live outside the type's body, in the same package, which means you can attach methods to any named type you define, not just structs. There's no class to open up.",
			},
		},
		{
			type: "text",
			value: {
				en: "The receiver is a parameter, and the last two lessons told you everything about parameters: they're copies unless they're pointers. So <code>(c Counter)</code> receives a copy of the counter and <code>(c *Counter)</code> receives its address. That single distinction decides whether a method can mutate. Watch the classic mistake, then the fix:",
			},
		},
	],
	program: `package main

import "fmt"

type Counter struct {
	count int
}

// Value receiver: c is a copy. Fine for reading.
func (c Counter) Value() int {
	return c.count
}

// BROKEN for mutation: increments the copy, then throws it away.
func (c Counter) IncBroken() {
	c.count++
}

// Pointer receiver: c is the caller's Counter. Mutation sticks.
func (c *Counter) Inc() {
	c.count++
}

func main() {
	var hits Counter

	hits.IncBroken()
	hits.IncBroken()
	fmt.Println("after IncBroken x2:", hits.Value())

	hits.Inc()
	hits.Inc()
	fmt.Println("after Inc x2:      ", hits.Value())
}`,
	after: [
		{
			type: "text",
			value: {
				en: "The output says it all: two calls to <code>IncBroken</code> leave the counter at 0, because each call incremented a copy that vanished at return. Exactly <code>doubleCopy</code> from the pointers lesson, wearing method syntax. <code>Inc</code> works because <code>*Counter</code> makes the receiver a pointer, and <code>c.count++</code> writes through it.",
			},
		},
		{
			type: "text",
			value: {
				en: "Notice you wrote <code>hits.Inc()</code>, not <code>(&hits).Inc()</code>. When you call a pointer-receiver method on an addressable value, Go takes the address for you; the shorthand is automatic and universal in real code. The convention to internalize: if any method on a type needs a pointer receiver, give all its methods pointer receivers, so the type has one consistent contract instead of a mixed one readers must check method by method.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Methods attach to any named type, not just structs. <code>type Celsius float64</code> can carry <code>func (c Celsius) Freezing() bool { return c <= 0 }</code>. This is how Go gives domain meaning to primitive data without wrapping it in a class: the type is still a float64 in memory, with behavior attached at compile time.",
			},
		},
	],
	retrievalPrompts: [
		"A method func (c Counter) Inc() { c.count++ } compiles but the counter never advances. Why? || The value receiver makes c a copy of the caller's Counter; the increment mutates the copy, which is discarded at return. Any mutating method needs a pointer receiver: func (c *Counter) Inc().",
		"You call hits.Inc() where Inc has receiver *Counter and hits is a plain Counter variable. Why does this compile? || Go automatically takes the address of an addressable value when calling a pointer-receiver method: hits.Inc() means (&hits).Inc(). You almost never write the & yourself at method call sites.",
		"When should a type mix value and pointer receivers across its methods? || Practically never. If any method mutates (needs *T), give every method on that type a pointer receiver so the type has one consistent contract. Mixed receivers force readers to check each method to know whether calls can mutate.",
	],
}
