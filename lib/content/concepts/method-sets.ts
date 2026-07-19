import { Concept } from "../../content"

export const methodSets: Concept = {
	slug: "method-sets",
	name: "Method sets",
	tagline:
		"A pointer-receiver method lives in the method set of *T but not T, so a value can fail an interface its own address would satisfy.",
	summary:
		"A type's method set is the collection of methods reachable on it through an interface, and the method set of <code>T</code> and <code>*T</code> are not equal: <code>*T</code> has every method the type defines, <code>T</code> has only the value-receiver ones. So a type whose method has a pointer receiver satisfies an interface as <code>*T</code> but not as <code>T</code>. What hides this most of the time is addressability: when you call a pointer method on an addressable value the compiler quietly takes the address for you, so <code>t.Method()</code> just works and you never notice <code>T</code> lacks the method. The instant the value is not addressable, a map element, a function's return value, the dynamic value inside an interface, that rescue is gone and the identical call stops compiling.",
	mentalModel:
		"Two rules run at once and it is easy to believe there is only one. The method-set rule is fixed and unforgiving: interface satisfaction asks whether a method is in the type's method set, and pointer-receiver methods sit only in <code>*T</code>'s set. The addressability rescue is a syntactic convenience layered on plain method calls: write <code>x.PtrMethod()</code> where <code>x</code> is something the compiler can take the address of, and it rewrites the call to <code>(&amp;x).PtrMethod()</code> on your behalf. The rescue makes the first rule invisible in everyday code, so the rule only surfaces where the rescue cannot reach: a value with no home address, which is anything you cannot legally put to the right of <code>&amp;</code>. The question is never what methods does this type have, it is whose method set is being checked, and is this value addressable.",
	retrievalPrompts: [
		"Your type has a String() method on a pointer receiver. fmt.Println(v) ignores it but fmt.Println(&v) uses it. Why? || fmt checks at runtime whether the value it received satisfies fmt.Stringer. String has a pointer receiver, so it is in the method set of *T only: a T value does not implement Stringer and fmt falls back to default struct formatting, while a *T value does implement it and fmt calls String. The method exists in the source either way; what differs is whose method set it belongs to, and interface satisfaction reads the method set.",
		"You can write t.PtrMethod() on a local variable of value type, but m[k].PtrMethod() does not compile. Why the difference? || Addressability. A local variable is addressable, so the compiler rewrites t.PtrMethod() to (&t).PtrMethod() for you. A map element m[k] is not addressable, because the map may relocate entries when it grows, so its address cannot be taken and the auto-& rescue cannot apply. The error is literally cannot call pointer method String on Celsius. Copy the element into a variable first and it is addressable again.",
		"You see var _ Iface = T{} guarding one type and var _ Iface = &T{} guarding another. What does each assert, and can they disagree? || Each asserts a different method set satisfies Iface: the first that T's does, the second that *T's does. They can disagree, but only in one direction. Because *T's method set is a superset of T's, the pointer form can pass where the value form fails, never the reverse. If any method Iface requires has a pointer receiver, only the &T{} line compiles, and that line is telling you callers must hold a pointer to satisfy the interface.",
	],
	codeExample: `package main

import "fmt"

type Celsius struct {
	deg int
}

// Pointer receiver: String is in the method set of *Celsius, not Celsius.
func (c *Celsius) String() string {
	return fmt.Sprintf("%dC", c.deg)
}

func main() {
	c := Celsius{deg: 20}

	// fmt asks at runtime: does this argument satisfy fmt.Stringer?
	// A Celsius value does NOT (String has a pointer receiver), so fmt prints
	// the default struct format. A *Celsius DOES, so fmt calls String().
	fmt.Println(c)  // {20}
	fmt.Println(&c) // 20C

	// c.String() still compiles: c is an addressable variable, so the
	// compiler rewrites it to (&c).String() for you.
	fmt.Println(c.String()) // 20C

	// Assigning to an interface makes the method-set rule explicit.
	var s fmt.Stringer = &c // ok: *Celsius implements Stringer
	fmt.Println(s.String()) // 20C
	// var bad fmt.Stringer = c // compile error: Celsius does not implement
	//                          // fmt.Stringer (String has pointer receiver)

	// A value read from a map is not addressable, so the auto-& rescue does
	// not apply: m["out"].String() would not compile. Copy it out first.
	m := map[string]Celsius{"out": {deg: 5}}
	out := m["out"]
	fmt.Println(out.String()) // 5C
}`,
	codeExplanation:
		"This prints five lines: <code>{20}</code>, then <code>20C</code> three times, then <code>5C</code>. The first two lines are the entire point. <code>fmt.Println(c)</code> hands fmt a <code>Celsius</code> value; fmt tests it against <code>fmt.Stringer</code>, finds it does not satisfy the interface (<code>String</code> is in <code>*Celsius</code>'s method set, not <code>Celsius</code>'s), and falls back to the default struct format <code>{20}</code>. <code>fmt.Println(&amp;c)</code> hands it a <code>*Celsius</code>, which does satisfy <code>Stringer</code>, so fmt calls <code>String</code> and prints <code>20C</code>. The third line, <code>c.String()</code>, compiles even though <code>String</code> is a pointer method, because <code>c</code> is an addressable variable and the compiler rewrites the call to <code>(&amp;c).String()</code>. The two commented-out lines are the failure cases, and both are real on go1.22.1: <code>var bad fmt.Stringer = c</code> gives <code>Celsius does not implement fmt.Stringer (method String has pointer receiver)</code>, and <code>m[\"out\"].String()</code> gives <code>cannot call pointer method String on Celsius</code>, because a map element is not addressable and the auto-&amp; rescue has nowhere to write. Copying it into <code>out</code> restores addressability, which is why <code>out.String()</code> prints <code>5C</code>.",
	designRationale:
		"The split exists because a pointer-receiver method may mutate its receiver, and to mutate it the call needs a real address to write through. Go's rule is to let you invoke such a method on a plain value only when it can manufacture that address, which it can exactly when the value is addressable. The same logic is why <code>T</code>'s method set excludes pointer methods at all: an arbitrary <code>T</code> value, for example one boxed inside an interface, has no guaranteed address, so promising that <code>T</code> satisfies an interface whose method might write through a pointer would be a promise the runtime could not keep. Encoding the difference in the method sets moves the problem to compile time, where <code>Celsius does not implement fmt.Stringer</code> is a precise message, rather than letting a mutation silently land on a temporary copy that is discarded a line later. The addressability rescue then hands the ergonomics back for the common case, local variables and struct fields, so in ordinary code you rarely think about receivers at all. It is the usual Go bargain: the safe behavior is what the compiler can prove, and the convenience is added only where it stays provably sound.",
	commonMistakes: [
		{
			title: "A pointer-receiver Stringer that never fires",
			body: "If <code>String</code> has a pointer receiver, then <code>fmt.Println(v)</code>, <code>%v</code>, <code>%s</code>, and every log call that formats <code>v</code> see a value that does not implement <code>fmt.Stringer</code> and print the default struct layout instead of your text. Nothing errors; the output is just quietly wrong. Pass <code>&amp;v</code>, or give <code>String</code> a value receiver so both <code>T</code> and <code>*T</code> carry it.",
		},
		{
			title: "Calling a pointer method on a map element",
			body: "<code>m[k].Mutate()</code> does not compile: <code>cannot call pointer method Mutate on T</code>. A map element is not addressable, because the map is free to move its entries on the next insert, so the compiler cannot synthesize the <code>&amp;</code> it needs. Read the element into a local first, mutate it there, and write it back: <code>v := m[k]; v.Mutate(); m[k] = v</code>.",
		},
		{
			title: "Splitting value and pointer receivers across one type",
			body: "Give some methods value receivers and others pointer receivers and the two method sets diverge in a way that is hard to track: <code>T</code> satisfies interfaces needing only the value-receiver methods, while <code>*T</code> satisfies everything. The same element then satisfies an interface in one place and not another depending on which methods are required. <code>go vet</code> warns about inconsistent receivers precisely for this; pick one receiver kind per type and keep it.",
		},
		{
			title: "Treating var _ Iface = T{} and var _ Iface = &T{} as the same check",
			body: "<code>var _ Iface = T{}</code> asserts <code>T</code>'s method set satisfies <code>Iface</code>; <code>var _ Iface = &amp;T{}</code> asserts <code>*T</code>'s does. They are different claims, and only the second holds when any required method has a pointer receiver. Write the assertion for the form your callers actually hold: if that is a pointer, only the <code>&amp;T{}</code> line proves what you need.",
		},
		{
			title: "Building a []Iface out of a slice of values",
			body: "When the element type satisfies <code>Iface</code> only as <code>*T</code>, a <code>[]T</code> cannot be passed around as a collection of <code>Iface</code>, and <code>append(ifaces, xs[i])</code> will not compile. Taking <code>&amp;xs[i]</code> does work, because a slice element is addressable unlike a map element, but a plain copy does not. When the interface needs pointer methods, hold <code>[]*T</code> from the start so every element is already the form that satisfies it.",
		},
	],
	relatedSlugs: ["interfaces", "pointers", "value-semantics", "typed-nil"],
}
