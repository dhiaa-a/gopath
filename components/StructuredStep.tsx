import { GoCodeBlock } from "./GoCode"

export function StructuredStep({
	intent,
	concept,
	implementation,
	filename,
}: {
	intent: string
	concept: string
	implementation?: string
	filename?: string
}) {
	return (
		<div className="mb-6 rounded-xl border border-border bg-surface p-5">
			<div className="mb-3">
				<div className="font-mono text-xs text-go-cyan mb-1">
					intent
				</div>
				<p className="text-sm text-muted">{intent}</p>
			</div>

			<div className="mb-3">
				<div className="font-mono text-xs text-go-teal mb-1">
					concept
				</div>
				<p className="text-sm text-muted">{concept}</p>
			</div>

			{implementation && (
				<div>
					<div className="font-mono text-xs text-go-amber mb-2">
						implementation
					</div>
					<GoCodeBlock code={implementation} filename={filename} />
				</div>
			)}
		</div>
	)
}
