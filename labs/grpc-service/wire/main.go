// Command wire prints what protobuf actually puts on the wire, and then
// decodes those same bytes three more times as three different messages to
// show what the decoder matches on.
//
// Nothing here is graded. It is a microscope. Run it before you write a line
// of the server:
//
//	go run ./wire
//
// The claim it exists to make checkable is the one every protobuf tutorial
// asserts and never shows: the field names are not on the wire. Field
// numbers are. Everything about proto's compatibility rules follows from
// that one fact, and you can read it out of the hex below.
package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"

	"gopath.dev/labs/grpc-service/userspb"
	"gopath.dev/labs/grpc-service/wirepb"
)

func main() {
	ada := &userspb.User{
		Id:    "u1",
		Name:  "Ada Lovelace",
		Email: "ada@example.com",
	}

	raw, err := proto.Marshal(ada)
	if err != nil {
		panic(err)
	}

	section("1. The bytes")
	fmt.Printf("proto.Marshal(%v)\n\n", ada)
	hexdump(raw)

	section("2. What those bytes say")
	fmt.Println("Walking the same bytes with protowire, the low-level reader the")
	fmt.Println("generated code is built on. Note what is present and what is not.")
	fmt.Println()
	walk(raw)

	section("3. The same message as JSON")
	j, err := json.Marshal(map[string]string{
		"id": ada.GetId(), "name": ada.GetName(), "email": ada.GetEmail(),
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s\n\n", j)
	fmt.Printf("json:  %2d bytes, and %q, %q and %q are all in there as text.\n",
		len(j), "id", "name", "email")
	fmt.Printf("proto: %2d bytes, and not one letter of a field name.\n", len(raw))
	fmt.Println()
	fmt.Println("That is the whole trade. JSON is self-describing: a decoder that")
	fmt.Println("has never seen your schema can still tell you the field is called")
	fmt.Println("\"email\". Proto is not: byte 0x1a means field 3, and only the")
	fmt.Println("schema knows field 3 is the email. You gave up self-description")
	fmt.Println("and bought two things with it, size and a compiler-checked")
	fmt.Println("contract. Sections 4 to 6 are the bill for it.")

	section("4. Decoding the same bytes as RenamedUser")
	var renamed wirepb.RenamedUser
	if err := proto.Unmarshal(raw, &renamed); err != nil {
		fmt.Println("unmarshal failed:", err)
	}
	fmt.Println("wire.v1.RenamedUser calls these fields user_id, full_name and")
	fmt.Println("email_address. Same numbers, no name in common with User:")
	fmt.Println()
	fmt.Printf("  user_id       = %q\n", renamed.GetUserId())
	fmt.Printf("  full_name     = %q\n", renamed.GetFullName())
	fmt.Printf("  email_address = %q\n", renamed.GetEmailAddress())
	fmt.Println()
	fmt.Println("Perfect. Every value landed where it belongs, because the names")
	fmt.Println("were never on the wire to disagree about. Renaming a field is a")
	fmt.Println("source change for your own code and a no-op for every client.")

	section("5. Decoding the same bytes as ShuffledUser")
	var shuffled wirepb.ShuffledUser
	if err := proto.Unmarshal(raw, &shuffled); err != nil {
		fmt.Println("unmarshal failed:", err)
	}
	fmt.Println("wire.v1.ShuffledUser uses the same three names as User and")
	fmt.Println("rotates the numbers: id = 3, name = 1, email = 2. This is what a")
	fmt.Println("client sees when someone edits field numbers and does not")
	fmt.Println("regenerate it:")
	fmt.Println()
	fmt.Printf("  id    = %q\n", shuffled.GetId())
	fmt.Printf("  name  = %q\n", shuffled.GetName())
	fmt.Printf("  email = %q\n", shuffled.GetEmail())
	fmt.Println()
	fmt.Println("Every single field is wrong. proto.Unmarshal returned nil. There")
	fmt.Println("is no error to check, no log line, no metric. The types matched,")
	fmt.Println("so the decoder did exactly what it was told: put field 1 in")
	fmt.Println("whatever this message calls field 1. Your email address is now")
	fmt.Println("somebody's user id, in a database, forever.")

	section("6. Decoding as OnlyID, a client that predates two fields")
	var old wirepb.OnlyID
	if err := proto.Unmarshal(raw, &old); err != nil {
		fmt.Println("unmarshal failed:", err)
	}
	fmt.Printf("  id = %q\n", old.GetId())
	fmt.Printf("  fields it had never heard of: %d unknown byte(s) retained\n",
		len(old.ProtoReflect().GetUnknown()))
	fmt.Println()

	back, err := proto.Marshal(&old)
	if err != nil {
		panic(err)
	}
	fmt.Println("Now marshal that old message straight back out and compare it")
	fmt.Println("to the bytes it was decoded from:")
	fmt.Println()
	fmt.Printf("  in:  %x\n", raw)
	fmt.Printf("  out: %x\n", back)
	fmt.Printf("  identical: %t\n", string(raw) == string(back))
	fmt.Println()
	fmt.Println("Unknown fields are kept, not dropped and not an error. That is")
	fmt.Println("what makes adding a field safe, and it is what lets a proxy")
	fmt.Println("built against an old schema forward a message it does not")
	fmt.Println("understand without destroying the parts it cannot see.")

	section("The rule, and where it comes from")
	fmt.Println("Renaming a field: safe, section 4 proved it.")
	fmt.Println("Adding a field:   safe, section 6 proved it.")
	fmt.Println("Changing or reusing a number: silent data corruption, section 5.")
	fmt.Println()
	fmt.Println("Which is why a retired field number gets `reserved` and never")
	fmt.Println("gets handed to a new field. The number is the API. The name is a")
	fmt.Println("comment that your compiler happens to check.")
}

// walk decodes the tag/value structure of a protobuf message without any
// knowledge of what the message is supposed to be. This is all a decoder
// has: numbers and wire types.
func walk(b []byte) {
	fmt.Printf("  %-12s %-8s %-14s %s\n", "BYTES", "FIELD", "WIRE TYPE", "VALUE")
	for len(b) > 0 {
		num, typ, n := protowire.ConsumeTag(b)
		if n < 0 {
			fmt.Println("  bad tag:", protowire.ParseError(n))
			return
		}
		tagBytes := b[:n]
		b = b[n:]

		switch typ {
		case protowire.BytesType:
			v, vn := protowire.ConsumeBytes(b)
			if vn < 0 {
				fmt.Println("  bad value:", protowire.ParseError(vn))
				return
			}
			// The length prefix is part of the value encoding, so show it
			// with the tag: 0x0a 0x02 is "field 1, LEN, 2 bytes follow".
			fmt.Printf("  %-12x %-8d %-14s %q\n",
				append(append([]byte{}, tagBytes...), b[:vn-len(v)]...),
				num, "2 (LEN)", v)
			b = b[vn:]
		case protowire.VarintType:
			v, vn := protowire.ConsumeVarint(b)
			if vn < 0 {
				fmt.Println("  bad value:", protowire.ParseError(vn))
				return
			}
			fmt.Printf("  %-12x %-8d %-14s %d\n", tagBytes, num, "0 (VARINT)", v)
			b = b[vn:]
		default:
			fmt.Printf("  %-12x %-8d %-14v (not used by this message)\n", tagBytes, num, typ)
			return
		}
	}
	fmt.Println()
	fmt.Println("  Three fields, three numbers, three types. No \"id\". No \"name\".")
	fmt.Println("  No \"email\". Nothing in these bytes knows what they are called.")
}

func hexdump(b []byte) {
	for i := 0; i < len(b); i += 16 {
		end := i + 16
		if end > len(b) {
			end = len(b)
		}
		chunk := b[i:end]
		var ascii strings.Builder
		for _, c := range chunk {
			if c >= 0x20 && c < 0x7f {
				ascii.WriteByte(c)
			} else {
				ascii.WriteByte('.')
			}
		}
		fmt.Printf("  %04x  %-32x  %s\n", i, chunk, ascii.String())
	}
	fmt.Printf("\n  %d bytes total\n", len(b))
}

func section(title string) {
	fmt.Printf("\n%s\n%s\n\n", title, strings.Repeat("─", len(title)))
}
