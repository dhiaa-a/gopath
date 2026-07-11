import { Tier0Lesson } from "../../content"
import { hello } from "./hello"
import { variables } from "./variables"
import { types } from "./types"
import { functions } from "./functions"
import { controlFlow } from "./control-flow"
import { pointers } from "./pointers"
import { structs } from "./structs"
import { methods } from "./methods"
import { slices } from "./slices"
import { maps } from "./maps"
import { stringsBytesRunes } from "./strings-bytes-runes"
import { closures } from "./closures"
import { errors } from "./errors"
import { packages } from "./packages"

export const tier0Lessons: Tier0Lesson[] = [
	hello,
	variables,
	types,
	functions,
	controlFlow,
	pointers,
	structs,
	methods,
	slices,
	maps,
	stringsBytesRunes,
	closures,
	errors,
	packages,
]
