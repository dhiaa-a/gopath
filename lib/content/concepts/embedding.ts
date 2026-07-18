import { Concept } from "../../content"

export const embedding: Concept = {
	slug: "embedding",
	name: "Embedding",
	tagline:
		"Composition with method promotion. It looks like inheritance until an embedded method calls the method you overrode.",
	summary:
		"Declaring a field with a type and no name embeds it, and the embedded type's fields and methods are <em>promoted</em>: <code>l.Describe()</code> is legal even though <code>Loud</code> has no <code>Describe</code>. That much looks like <code>extends</code>, and it is not. Promotion is a compile-time rewrite, so <code>l.Describe()</code> becomes <code>l.Base.Describe()</code> and the receiver inside is a <code>Base</code>, a copy of the embedded field, with no idea it is inside a <code>Loud</code> and no pointer back to it. There is no virtual dispatch. Your override shadows the promoted method for callers who hold a <code>Loud</code>, and is invisible to every method that <code>Base</code> already had.",
	mentalModel:
		"An embedded field is a field with an automatic forwarding rule, not a parent class. The compiler is doing something closer to search-and-replace than to dynamic binding: it looks for the shallowest field or method with the name you wrote and rewrites your selector to reach it. Everything surprising about embedding follows from that being a purely syntactic, purely compile-time step. There is no vtable, so an embedded method cannot call your override. Shallower always beats deeper, silently, because the search stops at the first depth that matches. Two matches at the same depth cancel out, and the name is simply not promoted, which is how a type quietly stops satisfying an interface. And <code>Loud</code> is not a <code>Base</code>: a function taking <code>Base</code> rejects a <code>Loud</code>, because forwarding a method name is not the same as being the type.",
	retrievalPrompts: [
		"Base has Describe() which calls b.Name(). Loud embeds Base and defines its own Name(). You call loud.Describe(). Which Name() runs? || Base's. Promotion is a compile-time rewrite: loud.Describe() becomes loud.Base.Describe(), whose receiver is a Base, a copy of the embedded field, with no back-pointer to the Loud that contains it. There is no vtable, so Base.Describe is statically bound to Base.Name and your override is invisible to it. Java prints \"I am LOUD widget\" here and Go prints \"I am widget\". Routing the call through an interface does not rescue it either: the method table for Loud holds a compiler-generated wrapper that calls loud.Base.Describe(), so the same thing happens.",
		"You embed two types in a struct and both have a String() method. What does the compiler say, and what does fmt.Println of your struct print? || The compiler says nothing, and Println prints a struct dump like {I am A I am B} rather than either String(). At equal depth the two candidates cancel and the name is not promoted at all, so your type silently is not a fmt.Stringer, and go vet is silent too. The selector is only an error where you write it, and you never wrote it: fmt just asked whether the type implements Stringer, got no, and fell back to printing the fields. A compile-time assertion, var _ fmt.Stringer = C{}, is the line that would have caught it.",
		"You embed sync.Mutex in an exported struct so you can write c.Lock(). What did you just publish? || Lock and Unlock, as part of your type's public API, plus satisfaction of sync.Locker. Embedding names the field after the type, so the field is Mutex and it is exported, and there is no way to embed it unexported. Any package that imports yours can now lock your struct, hold it, or hand it to something expecting a sync.Locker, and your ability to change the locking strategy later is gone because it was never internal. A named field, mu sync.Mutex, gives you c.mu.Lock() and keeps the decision yours.",
	],
	codeExample: `package main

import "fmt"

type Describer interface{ Describe() string }

type Base struct{ name string }

func (b Base) Name() string     { return b.name }
func (b Base) Describe() string { return "I am " + b.Name() }

// Loud embeds Base. In Java this line is "extends". It is not.
type Loud struct{ Base }

// The "override".
func (l Loud) Name() string { return "LOUD " + l.name }

func main() {
	l := Loud{Base{name: "widget"}}

	fmt.Println(l.Name())     // your method: shadows the promoted one
	fmt.Println(l.Describe()) // promoted from Base. Watch which Name() it calls.

	// Loud has no Describe of its own. It satisfies Describer BY PROMOTION.
	var d Describer = l
	fmt.Println(d.Describe()) // going through the interface does not rescue it
}`,
	codeExplanation:
		"This prints <code>LOUD widget</code>, then <code>I am widget</code>, then <code>I am widget</code>. The first line is the one that builds the false confidence: shadowing works exactly as you expect, so <code>l.Name()</code> finds <code>Loud.Name</code> at depth 0 and stops before it ever reaches the promoted one. The second line is the whole page. <code>l.Describe()</code> is rewritten by the compiler to <code>l.Base.Describe()</code>, which means the receiver is a <code>Base</code>: a <em>copy of the embedded field</em>, holding <code>name</code> and nothing else, with no pointer back to the <code>Loud</code> that contains it. Inside <code>Describe</code>, <code>b.Name()</code> is an ordinary static call to <code>Base.Name</code>, resolved at compile time, because there is no vtable in which <code>Loud.Name</code> could have replaced anything. Your override is not overriding: it is a different method on a different type that happens to share a name. The third line closes the escape route people reach for next. <code>Loud</code> satisfies <code>Describer</code> even though it has no <code>Describe</code>, and it does so by promotion rather than by magic: the compiler generates a wrapper method on <code>Loud</code> whose entire body is <code>l.Base.Describe()</code>, and that wrapper is what goes in the interface's method table. So dynamic dispatch does happen, and it dispatches to the wrapper, which then makes the same static call as before. The dispatch was never the missing piece. If <code>Base</code> needs behaviour it does not own, it has to say so: give it a <code>Namer</code> interface field and pass the <code>Loud</code> in. That turns an invisible coupling into a visible one, which is the trade Go is making on your behalf.",
	designRationale:
		"Go has no inheritance, and embedding is not a partial implementation of it that stops short. It is the deliberate result of splitting a thing that other languages fuse. Inheritance bundles two unrelated features: reuse (I want the parent's code) and polymorphism (I want to be substitutable for the parent). Go hands you the first with embedding and the second with interfaces, and refuses to connect them, which is why <code>Loud</code> borrows every method <code>Base</code> has and still cannot be passed to <code>func takesBase(b Base)</code>: <code>cannot use Loud{...} (value of type Loud) as Base value in argument to takesBase</code>. The missing virtual dispatch is the load-bearing half of that split, and it is aimed at a specific known failure, the fragile base class problem: when a base class calls its own virtual method, every subclass has silently overridden part of the base's internal control flow, so a later edit to the base can break subclasses that never changed, and a subclass edit can break the base. The coupling is real, invisible in both files, and unbounded, because any method the base calls on itself is an extension point whether the author meant it or not. Go's answer is that a type which needs behaviour it does not own must take that behaviour as an interface value, in a field, where you can see it. The cost is paid in exactly one place, and it is the code above: the pattern that Java and Python programmers reach for first is not just unsupported but silently produces a plausible wrong answer, because the call compiles, runs, and returns something that looks almost right. That silence is the genuine wart. The compiler could in principle warn that a promoted method is shadowed by a method it will never call, and it does not. The comfort is that the rule underneath is small enough to hold in your head: promotion is a shallowest-name-wins rewrite performed at compile time, and every surprise in this page is that sentence, applied honestly.",
	commonMistakes: [
		{
			title: "Expecting an embedded method to call your override",
			body: "The single biggest surprise for anyone arriving from Java, C#, or Python. <code>Base.Describe</code> calling <code>b.Name()</code> calls <code>Base.Name</code>, forever, no matter what <code>Loud</code> defines, because the receiver is a copy of the embedded <code>Base</code> and there is no back-pointer or vtable. The bug is quiet: it compiles, it runs, and it returns a plausible value that is wrong. If a type needs to call behaviour a container supplies, it must hold that behaviour as an interface field.",
		},
		{
			title: "Embedding an interface for a partial stub and calling the part you skipped",
			body: "<code>type fakeConn struct { net.Conn }</code> is a legitimate and widely used trick: embed the interface, implement the two methods your test touches, and the type satisfies all fifteen. The embedded interface is nil, so the other thirteen are a loaded gun. <code>c.Read(b)</code> works and <code>c.LocalAddr()</code> gives <code>panic: runtime error: invalid memory address or nil pointer dereference</code>, from a type that compiled and satisfied the interface. Use it deliberately, and know that it converts a compile error into a runtime one.",
		},
		{
			title: "Embedding sync.Mutex in an exported struct",
			body: "Embedding names the field after the type, so an embedded <code>sync.Mutex</code> is a field called <code>Mutex</code>, and that is exported. You have published <code>Lock</code> and <code>Unlock</code> as API and made your type a <code>sync.Locker</code>, so any importer can lock your struct or hand it to something that will. Your locking strategy is now a compatibility promise. <code>mu sync.Mutex</code> as a named unexported field costs you three characters at each call site and keeps the decision internal.",
		},
		{
			title: "Ambiguous promotion silently un-satisfying an interface",
			body: "Embed two types that both have <code>String()</code> and neither is promoted: at equal depth the candidates cancel, and the name is only an error at a selector you never wrote. So the type quietly stops being a <code>fmt.Stringer</code>, <code>go vet</code> says nothing, and <code>fmt.Println(c)</code> prints <code>{I am A I am B}</code>, a struct dump that formatted each field with its own String method. <code>var _ fmt.Stringer = C{}</code> next to the type turns this into a build failure, which is where it belongs.",
		},
		{
			title: "Trusting the depth rule to stay put",
			body: "Shallower wins outright, with no ambiguity error, so a method promoted from depth 2 is silently replaced the day something at depth 1 grows the same name. Embed a library type and give your struct a helper called <code>Close</code>, or take an upgrade where the library adds a method you already had deeper, and the call site does not change, does not warn, and now runs different code. Depth is resolved at compile time against whatever the tree looks like that day, and the tree includes types you do not own.",
		},
	],
	relatedSlugs: ["structs", "interfaces", "sync-mutex", "typed-nil"],
}
