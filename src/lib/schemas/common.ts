import * as v from 'valibot';

// Backend nullable string normalized to undefined so consumers can use `?.` and `||` ergonomically
export const NullableString = v.pipe(
	v.nullable(v.string()),
	v.transform((value) => value ?? undefined)
);

// Backend nullable string array normalized to undefined for the same reason
export const NullableStringArray = v.pipe(
	v.nullable(v.array(v.string())),
	v.transform((value) => value ?? undefined)
);
