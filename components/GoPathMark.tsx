// The GoPath mark: a "G" drawn as a single continuous orthogonal path — right
// angles only, no curves — terminating in a filled square waypoint. It is built
// from the same right angles as the rest of the Modernist system, so it sits
// inside the grid instead of decorating it, and it is one stroke shape, so it
// survives compression to 16px.
//
// Colour comes from `currentColor`: set it on the parent. Never recolour it to
// the old cyan, wrap it in a rounded container, or give it a shadow.
export function GoPathMark({
	size = 24,
	strokeWidth = 4,
	className,
}: {
	size?: number
	strokeWidth?: number
	className?: string
}) {
	// The node is centred on the path's terminal point (17,17) and sits two
	// units wider than the stroke, so it reads as a stop rather than as the
	// line thickening. The nav renders at 20px with a 5-wide stroke, which this
	// resolves to the 7×7 node the spec draws there.
	const node = strokeWidth + 2
	const offset = 17 - node / 2

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 32 32"
			fill="none"
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<polyline
				points="24,6 10,6 10,26 24,26 24,17 17,17"
				stroke="currentColor"
				strokeWidth={strokeWidth}
				strokeLinecap="square"
				strokeLinejoin="miter"
			/>
			<rect x={offset} y={offset} width={node} height={node} fill="currentColor" />
		</svg>
	)
}
