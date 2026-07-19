import { Concept } from "../../content"

export const encodingJson: Concept = {
	slug: "encoding-json",
	name: "encoding/json beyond the basics",
	tagline:
		"A one-character typo in a struct tag zeroes that field, returns err == nil, and decodes everything else correctly.",
	summary:
		"The basics (struct tags, exported fields, <code>Marshal</code>/<code>Unmarshal</code>) are on the <a href=\"/concepts/json-decode\">JSON encoding/decoding</a> page. This is the part that bites you in production. <code>encoding/json</code> is field-driven and forgiving by design: a JSON key with no matching struct field is silently dropped, and a struct field with no matching key is left at its zero value. Put those two together and a misspelled tag (<code>windspeed</code> for <code>wind_speed</code>) leaves exactly one field zero, fills every other field, and returns a <code>nil</code> error. Nothing in the type system says a field was required, so nothing tells you it stayed empty.",
	mentalModel:
		"Decoding is a one-directional match from JSON keys to struct fields, and both sides tolerate a miss. The decoder walks the incoming keys; for each one it looks for a field whose tag or name matches, and if it finds none it moves on without complaint. It never walks your fields to check they all got filled, because JSON is an interchange format where absent and optional are the normal case, not an error. So a successful Unmarshal means \"the bytes were valid JSON and I applied what I could match\", not \"your struct is now fully populated\". The gap between those two readings is where the misspelled tag, the dropped field, and the silently-zeroed value all live.",
	retrievalPrompts: [
		"Your struct tag says json:\"windspeed\" but the API sends \"wind_speed\". Unmarshal returns nil. What is in the field, and how do you make it complain? || Zero. The incoming key wind_speed matches no field so it is dropped, and your Wind field matches no key so it stays 0.0, and neither of those is an error to the decoder. Verified: a WeatherResponse with that typo decodes to {51.5 -0.1 {0 14.7}} with err == nil, every other field correct. To turn the silent drop into an error, decode with a json.Decoder and call DisallowUnknownFields(): now wind_speed is an \"unknown field\" and Decode returns json: unknown field \"wind_speed\".",
		"You decode {\"id\": 9007199254740993} into a map[string]any and read m[\"id\"]. Is it that number? || No, it is 9007199254740992, off by one. Into interface{} every JSON number becomes a float64, and 2^53+1 is the first integer a float64 cannot represent, so the low bit is gone before you ever touch it. There is no error. If the value is an ID or money, decode with a concrete int64 field, or use Decoder.UseNumber() so the number arrives as a json.Number holding the original text for you to parse exactly.",
		"An HTTP PATCH handler decodes into a struct with Active bool `json:\"active,omitempty\"`. The client sends {\"active\": false}. Did they ask to deactivate, or omit the field? || You cannot tell, and omitempty makes it worse on the way back out. A bool field is false whether the key was present-and-false or absent, because JSON false and Go's zero value are the same bits. Use *bool: nil means the key was absent, &false means they explicitly sent false. omitempty then also stops marshalling from emitting a genuine false, because it cannot distinguish it from unset either. For partial updates, pointers or json.RawMessage are the only things that carry presence.",
	],
	codeExample: `package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Current struct {
	Wind  float64 \`json:"windspeed"\`      // the API sends "wind_speed"
	TempC float64 \`json:"temperature_2m"\` // this one is right
}

type WeatherResponse struct {
	Lat     float64 \`json:"latitude"\`
	Lon     float64 \`json:"longitude"\`
	Current Current \`json:"current_weather"\`
}

const body = \`{"latitude":51.5,"longitude":-0.1,\` +
	\`"current_weather":{"temperature_2m":14.7,"wind_speed":9.3}}\`

func main() {
	// One underscore missing in one tag. Unmarshal reports success and zeroes
	// exactly one field. Every other field decodes, so the struct looks alive.
	var w WeatherResponse
	err := json.Unmarshal([]byte(body), &w)
	fmt.Printf("Unmarshal: %v err=%v\\n", w, err)

	// Same bytes, same struct, one opt-in line. The key the typo should have
	// matched is now an unknown field, so the decoder finally says so.
	var w2 WeatherResponse
	dec := json.NewDecoder(strings.NewReader(body))
	dec.DisallowUnknownFields()
	err = dec.Decode(&w2)
	fmt.Printf("Decoder:   %v err=%v\\n", w2, err)

	// Decoding into interface{} throws the type away: every JSON number
	// becomes float64, and float64 has 53 bits of mantissa. 2^53+1 does not
	// survive, and nothing reports that either.
	var m map[string]any
	json.Unmarshal([]byte(\`{"id":9007199254740993}\`), &m)
	fmt.Printf("any:       %T %.0f\\n", m["id"], m["id"])

	// UseNumber keeps the literal text and lets you pick the type.
	var n map[string]any
	d := json.NewDecoder(strings.NewReader(\`{"id":9007199254740993}\`))
	d.UseNumber()
	d.Decode(&n)
	id, _ := n["id"].(json.Number).Int64()
	fmt.Printf("UseNumber: %T %d\\n", n["id"], id)

	// omitempty asks "is this the zero value", never "was the key present".
	// A pointer separates them, because absent stays nil.
	type patch struct {
		Name  *string \`json:"name,omitempty"\`
		Admin *bool   \`json:"admin,omitempty"\`
	}
	var p patch
	json.Unmarshal([]byte(\`{"admin":false}\`), &p)
	fmt.Printf("patch:     name sent=%v  admin sent=%v value=%v\\n",
		p.Name != nil, p.Admin != nil, *p.Admin)

	// []byte is not an array of numbers on the wire, it is base64.
	out, _ := json.Marshal(struct {
		Key []byte \`json:"key"\`
	}{[]byte("hello")})
	fmt.Printf("[]byte:    %s\\n", out)
}`,
	codeExplanation:
		"This prints:<br><br><code>Unmarshal: {51.5 -0.1 {0 14.7}} err=&lt;nil&gt;</code><br><code>Decoder:   {51.5 -0.1 {0 14.7}} err=json: unknown field \"wind_speed\"</code><br><code>any:       float64 9007199254740992</code><br><code>UseNumber: json.Number 9007199254740993</code><br><code>patch:     name sent=false  admin sent=true value=false</code><br><code>[]byte:    {\"key\":\"aGVsbG8=\"}</code><br><br>Line 1 is the crux: the wind field is <code>0</code> inside <code>{0 14.7}</code>, every other number is correct, and the error is <code>nil</code>. If your code reads <code>w.Current.Wind</code> and acts on it, it acts on a zero that no test and no error ever flagged, because the only difference between this and a correct program is one underscore in a string literal the compiler does not check. Line 2 is the fix and it is opt-in for a reason: <code>DisallowUnknownFields</code> is the switch that turns the silently-dropped <code>wind_speed</code> into a returned error, and it only works through a <code>json.Decoder</code>, not <code>json.Unmarshal</code>. Lines 3 and 4 are the same integer decoded two ways: into <code>interface{}</code> it lands as <code>float64</code> and comes back <code>9007199254740992</code>, one less than it went in, while <code>UseNumber</code> preserves the digits. Line 5 shows why partial updates need pointers: <code>admin</code> was present so its pointer is non-nil, <code>name</code> was absent so it stayed nil, and a plain <code>bool</code> could not have told those apart. Line 6 is the surprise that a <code>[]byte</code> marshals as base64, not a JSON array of bytes.",
	designRationale:
		"The forgiving default is Postel's law written into a standard library: be liberal in what you accept. JSON is an interchange format between services that version independently, and if adding a field to a response broke every client that did not yet know about it, no API could ever evolve. So the decoder drops unknown keys by default, which is exactly the behaviour that lets a server add fields without a flag day, and exactly the behaviour that hides your typo. Strictness had to be added as an opt-in later, <code>DisallowUnknownFields</code> in Go 1.10, precisely because flipping the default would have broken the compatibility promise for every program relying on the tolerance. The <code>float64</code> rule has a different root: JSON's grammar has a single <code>number</code> production with no integer-versus-real distinction, so when the decoder meets a bare number with no struct field to declare intent, it must pick one Go type that can represent the widest span of JSON numbers, and that is <code>float64</code>. The cost is the 53-bit mantissa, which is why <code>json.Number</code> exists as the escape hatch (since Go 1.1): it keeps the original text so you, who do know whether this is an ID or a temperature, can parse it exactly. None of these are oversights. They are the price of a format designed for loose coupling meeting a language that wants static types, and the tools to buy back the strictness are all present, just not on by default.",
	commonMistakes: [
		{
			title: "Trusting a nil error to mean the struct is populated",
			body: "A misspelled or wrong-case tag leaves its field at the zero value and returns no error, because an unmatched key is dropped and an unmatched field is simply not written. <code>Unmarshal</code> returning <code>nil</code> means the bytes parsed, not that your fields filled. Verify the values you depend on, or decode strictly.",
		},
		{
			title: "Not reaching for DisallowUnknownFields when you want strictness",
			body: "The default silently ignores unknown keys, so a renamed API field, a typo, or a config with a misspelled option all pass without a word. <code>json.NewDecoder(r).DisallowUnknownFields()</code> makes those an error. It is opt-in and only exists on <code>Decoder</code>, so <code>json.Unmarshal</code> can never be strict.",
		},
		{
			title: "Decoding numbers into interface{} or map[string]any",
			body: "Every JSON number becomes a <code>float64</code>, so any integer past 2^53 is silently rounded: <code>9007199254740993</code> reads back as <code>...992</code>. For IDs, money, or timestamps this is data loss with no error. Decode into a concrete <code>int64</code> field, or call <code>Decoder.UseNumber()</code> and parse the <code>json.Number</code> yourself.",
		},
		{
			title: "Using omitempty to mean the field was absent",
			body: "<code>omitempty</code> tests the zero value, not key presence, so it cannot distinguish an explicit <code>false</code>, <code>0</code>, or <code>\"\"</code> from unset, and on marshal it will drop a real <code>false</code> you meant to send. Partial-update handlers need <code>*bool</code>/<code>*string</code> (<code>nil</code> == absent) or <code>json.RawMessage</code> to carry presence.",
		},
		{
			title: "Expecting a pointer-receiver MarshalJSON to always run",
			body: "If <code>MarshalJSON</code> has a pointer receiver and you marshal a non-addressable value (a struct field, or a map value like <code>map[string]T</code>), the method is skipped and you get the default encoding with no error. Verified: a map value with a pointer-receiver marshaler emits <code>{\"k\":{\"A\":1}}</code>, not the custom form. Give <code>MarshalJSON</code> a value receiver, or hold pointers.",
		},
	],
	relatedSlugs: ["json-decode", "struct-tags", "http-client", "error-handling", "interfaces"],
}
