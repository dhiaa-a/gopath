import { Concept } from "../../content"

export const iota: Concept = {
	slug: "iota",
	name: "Constants and iota",
	tagline:
		"iota is a counter the compiler advances once per line of a const block, not a value you assign, so a blank line still moves it and two constants on one line share it.",
	summary:
		"Go has no <code>enum</code> keyword. What it has instead is <code>iota</code>, a predeclared identifier that inside a <code>const</code> block equals the index of the current line: 0 on the first ConstSpec, 1 on the second, and so on, resetting to 0 at the top of every <code>const</code> block. The rule that prevents every iota bug is that it counts <em>lines</em>, not names: a line with two constants uses one iota value for both, and a line that is nothing but <code>_</code> still consumes its number. When you leave the right-hand side off a line, Go repeats the previous line's expression textually with the new iota, which is what turns <code>1 &lt;&lt; iota</code> on one line into a whole column of powers of two. Typed enums, bit-flag sets, and scaled size constants all fall out of that one mechanism.",
	mentalModel:
		"Picture the <code>const</code> block as a numbered list and <code>iota</code> as the line number, starting at 0. Every ConstSpec, every line, gets the next number whether or not it mentions <code>iota</code> and whether or not it even has a name of its own: a bare <code>_</code> line is still line N and still burns number N. The second thing to hold is that a line with no expression is not empty, it inherits the previous line's expression verbatim with iota advanced. So <code>KB ByteSize = 1 &lt;&lt; (10 * iota)</code> followed by two blank-bodied lines is three copies of the same shift with iota equal to 1, 2, and 3. And the counter is local to the block: open a new <code>const (</code> and iota is 0 again, which is exactly why you cannot continue a numbering across two blocks. If you can answer \"what line is this, and what expression is being repeated onto it\", you can read any iota table in the standard library.",
	retrievalPrompts: [
		"You add a new status constant in the middle of an existing iota enum, and yesterday's persisted records now decode to the wrong status. What happened? || iota assigns numbers by line position, so every constant below the insertion point shifted up by one, and a value stored as 3 now names a different constant. There is no compile error and no panic, because every int is still a valid member of the type. Append new members at the end, or pin values explicitly, whenever the numbers are written to disk or the wire.",
		"Inside one const block you write `A, B = iota, iota + 10` then `C, D` on the next line. What are A, B, C, D? || A=0, B=10, C=1, D=11. iota counts lines, not identifiers, so A and B share iota==0 while C and D share iota==1. The second line has no right-hand side, so Go repeats `iota, iota + 10` textually with iota now 1. Two names on one line always see the same iota; the increment happens between lines.",
		"You close one const block and open a second, expecting the numbering to keep climbing, but the new constants start from 0. Why? || iota is the index within the current const block and resets to 0 at every `const (`. It is not a global counter, so nothing carries across the boundary. Keep all members of one enum in a single block; splitting them and expecting continuity is how you get two constants that both equal 0.",
	],
	codeExample: `package main

import (
	"fmt"
	"strings"
)

// A typed enum. iota is the const generator: it is 0 on the first line of a
// const block and increments once per line.
type Weekday int

const (
	Sunday Weekday = iota // 0
	Monday                // 1
	Tuesday               // 2
	Wednesday             // 3
	Thursday              // 4
	Friday                // 5
	Saturday              // 6
)

// Without a String method the enum prints as its underlying int.
func (d Weekday) String() string {
	names := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	if int(d) < 0 || int(d) >= len(names) {
		return fmt.Sprintf("Weekday(%d)", int(d))
	}
	return names[d]
}

// A bit-flag set: each flag is a distinct power of two via 1 << iota.
type Perm uint

const (
	Read    Perm = 1 << iota // 1 << 0 == 1
	Write                    // 1 << 1 == 2
	Execute                  // 1 << 2 == 4
)

func (p Perm) String() string {
	if p == 0 {
		return "none"
	}
	var parts []string
	if p&Read != 0 {
		parts = append(parts, "read")
	}
	if p&Write != 0 {
		parts = append(parts, "write")
	}
	if p&Execute != 0 {
		parts = append(parts, "execute")
	}
	return strings.Join(parts, "|")
}

// iota resets to 0 in a NEW const block, and a blank-identifier line still
// increments it: the _ line eats iota==0, so KB lands on iota==1.
type ByteSize float64

const (
	_           = iota             // iota==0, discarded
	KB ByteSize = 1 << (10 * iota) // iota==1 -> 1<<10
	MB                             // iota==2 -> 1<<20
	GB                             // iota==3 -> 1<<30
)

// Two ConstSpecs on ONE line share a single iota value: iota counts lines,
// not identifiers.
const (
	A, B = iota, iota + 10 // iota==0 -> A=0, B=10
	C, D                   // iota==1 -> C=1, D=11
)

func main() {
	fmt.Println("weekday enum:", Sunday, Wednesday, Saturday)
	fmt.Printf("weekday ints: %d %d %d\\n", Sunday, Wednesday, Saturday)

	combo := Read | Execute
	fmt.Println("perm flags:", Read, Write, Execute)
	fmt.Printf("perm ints: %d %d %d\\n", Read, Write, Execute)
	fmt.Println("combo read|execute:", combo, "= bits", uint(combo))

	fmt.Printf("sizes: KB=%d MB=%d GB=%d\\n", int(KB), int(MB), int(GB))

	fmt.Println("one line shares iota:", A, B, C, D)
}`,
	codeExplanation:
		"Running it prints seven lines. <code>weekday enum: Sunday Wednesday Saturday</code> and <code>weekday ints: 0 3 6</code> are the same three constants shown two ways: the <code>String()</code> method turns them into names, and <code>%d</code> shows the integers iota handed out by position, 0 for the first line, 3 for the fourth, 6 for the seventh. <code>perm flags: read write execute</code> with <code>perm ints: 1 2 4</code> is the <code>1 &lt;&lt; iota</code> trick: only the first line carries the expression, and the two blank-bodied lines below it repeat <code>1 &lt;&lt; iota</code> with iota equal to 1 and 2, giving the distinct bits 2 and 4. <code>combo read|execute: read|execute = bits 5</code> is the payoff of powers of two: <code>Read | Execute</code> is <code>1 | 4 == 5</code>, and because the bits do not overlap the <code>String()</code> method can pull them back apart. <code>sizes: KB=1024 MB=1048576 GB=1073741824</code> comes from a second block whose first line is <code>_ = iota</code>: that blank line consumes iota==0, so <code>KB</code> lands on iota==1 and <code>1 &lt;&lt; (10 * 1)</code> is 1024, then iota 2 and 3 give <code>1&lt;&lt;20</code> and <code>1&lt;&lt;30</code>. Delete the <code>_</code> line and every size is wrong by a factor of 1024, which is the whole point: a blank line is still a line and still moves the counter. The last line, <code>one line shares iota: 0 10 1 11</code>, is <code>A, B = iota, iota + 10</code> then <code>C, D</code>: A and B both see iota==0 so they are 0 and 10, C and D both see iota==1 so they are 1 and 11. Two names on a line, one iota.",
	designRationale:
		"Go left <code>enum</code> out of the language on purpose and gave you a smaller primitive that does more. <code>iota</code> is just a compile-time constant equal to the current line index inside a <code>const</code> block, and Go's constants are already powerful: untyped until used, arbitrary-precision, and evaluated entirely by the compiler. Hand those two facts to each other and you get typed enums (a <code>Weekday int</code> with named values), bit-flag sets (<code>1 &lt;&lt; iota</code>), and scaled constants (the <code>ByteSize</code> table) from one mechanism, with no dedicated enum syntax to learn and no runtime cost. The price of that minimalism is real and worth naming. There is no exhaustiveness check: the compiler will not tell you a <code>switch</code> missed a Weekday, because to the compiler a Weekday is an int and any int is a valid one. There is no automatic string form, which is why <code>String()</code> methods and the <code>stringer</code> code generator exist. And the numbering is positional, so the source order of the block is load-bearing in a way ordinary code is not: reorder the lines and the values change. Go's answer is that these are your concerns to manage, not the language's, which is the same posture it takes on zero values and error handling: a sharp, transparent tool, and the expectation that you know where its edges are.",
	commonMistakes: [
		{
			title: "Inserting or reordering a value in a persisted iota enum",
			body: "iota assigns numbers by position, so adding <code>Pending</code> between <code>Active</code> and <code>Closed</code> pushes <code>Closed</code> from 2 to 3 and renumbers everything below it. Any value already written to a database, a file, or the wire now decodes to the wrong constant, with no compile error and no panic, because the ints are all still valid. If the numbers ever leave the process, append new members at the end or assign them explicitly, and treat the order of the block as a schema.",
		},
		{
			title: "Forgetting the String method",
			body: "Without <code>func (d Weekday) String() string</code> the type is just an int to <code>fmt</code>, so <code>%v</code>, <code>%s</code>, and every log line print <code>3</code> instead of <code>Wednesday</code>, and the type does not satisfy <code>fmt.Stringer</code> where an interface expects one. The values are correct, they are just unreadable, which hurts most in exactly the place you need them: logs and errors. Write the method, or generate it with the <code>stringer</code> tool, and widen it every time you add a constant.",
		},
		{
			title: "Expecting iota to continue across const blocks",
			body: "iota is the index within the current block and resets to 0 at every <code>const (</code>. Split one enum across two blocks expecting the second to keep counting, and its first member silently equals 0, colliding with the first member of the first block. There is no global iota. Keep every member of one enum in a single <code>const</code> block; the block boundary is the reset.",
		},
		{
			title: "Miscounting the lines, including blank ones",
			body: "iota advances once per ConstSpec, which is once per line, not once per name. Two constants on one line, <code>A, B = iota, iota</code>, both get the same number, and a line that is only <code>_</code> still consumes its number rather than being skipped. Both facts bite when you count by hand: a stray blank line or a doubled-up line shifts every value after it. Read the block as a numbered list of lines and the arithmetic always works out.",
		},
		{
			title: "Forgetting that the first constant is the zero value",
			body: "The first line of an <code>iota</code> block is 0, and 0 is the zero value of the type, so a struct field of that enum type is your first constant until something sets it. Put <code>Active</code> first and every freshly allocated record reads as Active before any code ran; put an explicit <code>Unknown</code> or <code>Invalid</code> at position 0 and an unset field is detectably unset instead. The zero value is not nothing, it is whichever member you happened to write first.",
		},
	],
	relatedSlugs: ["interfaces", "method-sets", "structs", "nil"],
}
