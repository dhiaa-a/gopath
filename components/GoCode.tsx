// Simple Go syntax highlighter — no deps, pure regex
type Token = { type: string; value: string }

const KEYWORDS = new Set([
	"package",
	"import",
	"func",
	"var",
	"const",
	"type",
	"struct",
	"interface",
	"map",
	"chan",
	"go",
	"defer",
	"return",
	"if",
	"else",
	"for",
	"range",
	"switch",
	"case",
	"default",
	"break",
	"continue",
	"select",
	"fallthrough",
	"goto",
	"nil",
	"true",
	"false",
	"make",
	"new",
	"len",
	"cap",
	"append",
	"copy",
	"close",
	"delete",
	"panic",
	"recover",
	"print",
	"println",
	"error",
])

const BUILTIN_TYPES = new Set([
	"string",
	"int",
	"int8",
	"int16",
	"int32",
	"int64",
	"uint",
	"uint8",
	"uint16",
	"uint32",
	"uint64",
	"uintptr",
	"float32",
	"float64",
	"complex64",
	"complex128",
	"byte",
	"rune",
	"bool",
	"error",
])

function tokenize(code: string): Token[] {
	const tokens: Token[] = []
	let i = 0

	while (i < code.length) {
		// Line comment
		if (code[i] === "/" && code[i + 1] === "/") {
			const end = code.indexOf("\n", i)
			const val = end === -1 ? code.slice(i) : code.slice(i, end)
			tokens.push({ type: "comment", value: val })
			i += val.length
			continue
		}
		// Block comment
		if (code[i] === "/" && code[i + 1] === "*") {
			const end = code.indexOf("*/", i + 2)
			const val = end === -1 ? code.slice(i) : code.slice(i, end + 2)
			tokens.push({ type: "comment", value: val })
			i += val.length
			continue
		}
		// String with backtick
		if (code[i] === "`") {
			let j = i + 1
			while (j < code.length && code[j] !== "`") j++
			tokens.push({ type: "string", value: code.slice(i, j + 1) })
			i = j + 1
			continue
		}
		// String with double quote
		if (code[i] === '"') {
			let j = i + 1
			while (j < code.length && (code[j] !== '"' || code[j - 1] === "\\"))
				j++
			tokens.push({ type: "string", value: code.slice(i, j + 1) })
			i = j + 1
			continue
		}
		// Char literal
		if (code[i] === "'") {
			let j = i + 1
			while (j < code.length && (code[j] !== "'" || code[j - 1] === "\\"))
				j++
			tokens.push({ type: "string", value: code.slice(i, j + 1) })
			i = j + 1
			continue
		}
		// Number
		if (/[0-9]/.test(code[i])) {
			let j = i
			while (j < code.length && /[0-9._xXa-fA-F]/.test(code[j])) j++
			tokens.push({ type: "number", value: code.slice(i, j) })
			i = j
			continue
		}
		// Identifier / keyword
		if (/[a-zA-Z_]/.test(code[i])) {
			let j = i
			while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++
			const word = code.slice(i, j)
			// Check next non-space char — if '(' it's a function call
			let k = j
			while (k < code.length && code[k] === " ") k++
			if (KEYWORDS.has(word)) {
				tokens.push({ type: "keyword", value: word })
			} else if (BUILTIN_TYPES.has(word)) {
				tokens.push({ type: "type", value: word })
			} else if (code[k] === "(") {
				tokens.push({ type: "function", value: word })
			} else if (/^[A-Z]/.test(word)) {
				tokens.push({ type: "type", value: word })
			} else {
				tokens.push({ type: "ident", value: word })
			}
			i = j
			continue
		}
		// Punctuation / operator
		const punct = code[i]
		tokens.push({ type: "punct", value: punct })
		i++
	}
	return tokens
}

// Regroup a flat token stream into one array per source line. Tokens can carry
// newlines inside them (block comments, backtick strings) and the tokenizer
// also emits bare "\n" as punctuation, so splitting on the value is the only
// way to keep highlighting intact across a line break.
function splitLines(tokens: Token[]): Token[][] {
	const lines: Token[][] = [[]]
	for (const tok of tokens) {
		const parts = tok.value.split("\n")
		parts.forEach((part, i) => {
			if (i > 0) lines.push([])
			if (part) lines[lines.length - 1].push({ type: tok.type, value: part })
		})
	}
	// A trailing newline terminates the last line, it does not add an empty one.
	if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
	return lines
}

const COLOR: Record<string, string> = {
	keyword: "var(--sx-keyword)",
	type: "var(--sx-type)",
	function: "var(--sx-fn)",
	string: "var(--sx-string)",
	number: "var(--sx-number)",
	comment: "var(--sx-comment)",
	ident: "var(--sx-ident)",
	punct: "var(--sx-punct)",
}

export function GoCode({
	code,
	className,
	startLine,
}: {
	code: string
	className?: string
	// 1-indexed line number of the first line, for excerpts quoted out of a
	// larger file. Set it and the block grows a line-number gutter; leave it
	// unset and the block renders exactly as it always has. The source-reading
	// walkthroughs need the real numbers, because the promise of that track is
	// that you can open the same file and land on the same lines.
	startLine?: number
}) {
	const tokens = tokenize(code)

	if (startLine === undefined) {
		return (
			<code className={className}>
				{tokens.map((tok, i) => (
					<span key={i} style={{ color: COLOR[tok.type] ?? COLOR.ident }}>
						{tok.value}
					</span>
				))}
			</code>
		)
	}

	const lines = splitLines(tokens)
	// Width from the widest number so the gutter is exact in a monospace face
	// and every excerpt does not pay for the longest one on the page.
	const gutter = `${String(startLine + lines.length - 1).length}ch`

	return (
		<code className={className}>
			{lines.map((lineTokens, i) => (
				<span key={i} className="block">
					<span
						aria-hidden="true"
						className="mr-4 inline-block select-none text-right text-muted"
						style={{ width: gutter }}
					>
						{startLine + i}
					</span>
					{lineTokens.map((tok, j) => (
						<span
							key={j}
							style={{ color: COLOR[tok.type] ?? COLOR.ident }}
						>
							{tok.value}
						</span>
					))}
				</span>
			))}
		</code>
	)
}

export function GoCodeBlock({
	code,
	filename,
}: {
	code: string
	filename?: string
}) {
	return (
		<div className="my-4 overflow-hidden rounded-lg border border-border bg-[var(--color-code-bg)] text-sm">
			{filename && (
				<div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-2">
					<span className="h-2 w-2 rounded-full bg-red-500/60" />
					<span className="h-2 w-2 rounded-full bg-yellow-500/60" />
					<span className="h-2 w-2 rounded-full bg-green-500/60" />
					<span className="ml-1 font-mono text-xs text-muted">
						{filename}
					</span>
				</div>
			)}
			<pre className="overflow-x-auto p-4 leading-7">
				<GoCode code={code} />
			</pre>
		</div>
	)
}
