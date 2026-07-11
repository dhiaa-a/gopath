import { Concept } from "../../content"

export const interfaces: Concept = {
	slug: "interfaces",
	name: "Interfaces",
	tagline:
		"Implicit satisfaction: if you have the methods, you implement the interface.",
	summary:
		"A Go interface is just a set of method signatures. Any type that has those methods automatically satisfies the interface, no <code>implements</code> keyword needed. This makes interfaces incredibly flexible and enables loose coupling you'd struggle to achieve in other languages.",
	mentalModel:
		"An interface is a contract defined by the consumer, not the producer. If you need something that can be written to, you define <code>type Writer interface { Write([]byte) (int, error) }</code> and anything with a <code>Write</code> method fits: files, buffers, network connections, your custom type. You never touch those types.",
	retrievalPrompts: [
		"Define an interface called Stringer with one method, then write two types that satisfy it without any implements keyword. || type Stringer interface { String() string }. Any type with a String() string method satisfies it automatically. For example: type User struct{ Name string }; func (u User) String() string { return u.Name }. No declaration needed; satisfaction is implicit.",
		"A function accepts io.Writer. Name three standard library types that satisfy it, and explain why none import the io package to declare it. || os.File, bytes.Buffer, and net.Conn all satisfy io.Writer. None import io because Go interfaces are satisfied implicitly: if a type has Write([]byte) (int, error), it satisfies io.Writer regardless of whether it has ever seen the interface definition.",
		"Your struct has a method on a pointer receiver. Which satisfies the interface: T or *T? Why? || Only *T satisfies it. A pointer receiver method is only in the method set of *T. Using a plain T value where the interface is expected causes a compile error. However, *T includes methods from both pointer and value receivers.",
	],
	codeExample: `package main

import "fmt"

type Stringer interface {
	String() string
}

type User struct {
	Name  string
	Email string
}

func (u User) String() string {
	return fmt.Sprintf("%s <%s>", u.Name, u.Email)
}

type Bot struct {
	ID string
}

func (b Bot) String() string {
	return fmt.Sprintf("bot:%s", b.ID)
}

func printAll(items []Stringer) {
	for _, item := range items {
		fmt.Println(item.String())
	}
}

func main() {
	items := []Stringer{
		User{Name: "Alice", Email: "alice@example.com"},
		Bot{ID: "worker-01"},
	}
	printAll(items)
}`,
	codeExplanation:
		"<code>printAll</code> accepts any slice of <code>Stringer</code>. Both <code>User</code> and <code>Bot</code> have a <code>String()</code> method, so both satisfy the interface, without either type knowing about the interface.",
	designRationale:
		"Go interfaces are satisfied implicitly because the designers wanted to decouple the definition of an abstraction from the types that satisfy it. A type should not need to know about every interface it fits. This means a library can define an interface and any existing type with the right methods satisfies it without modification. The result is composition without inheritance: behaviour is shared through method sets, not class hierarchies.",
	commonMistakes: [
		{
			title: "Pointer vs value receiver mismatch",
			body: "If a method is defined on <code>*T</code> (pointer receiver), then <code>*T</code> satisfies the interface but <code>T</code> does not. If defined on <code>T</code>, both <code>T</code> and <code>*T</code> satisfy it. Mix-ups here cause 'does not implement interface' errors.",
		},
		{
			title: "Returning concrete types instead of interfaces",
			body: "Functions should accept interfaces, return concrete types. Returning interfaces couples the caller to an abstraction and prevents them from accessing type-specific methods.",
		},
		{
			title: "The empty interface any",
			body: "<code>any</code> (alias for <code>interface{}</code>) accepts everything. Use it sparingly; you lose all type safety. Prefer a specific interface with the methods you actually need.",
		},
	],
	relatedSlugs: ["http-handler", "error-handling"],
}
