import * as v from 'valibot';

const ThumbnailStateSchema = v.picklist(['Completed', 'Pending', 'Blocked', 'Error']);

const RobloxOutfitSchema = v.object({
	id: v.number(),
	name: v.string(),
	isEditable: v.boolean(),
	outfitType: v.string()
});

const RobloxOutfitsResponseSchema = v.object({
	data: v.array(RobloxOutfitSchema),
	paginationToken: v.nullable(v.string())
});

const RobloxThumbnailItemSchema = v.object({
	targetId: v.number(),
	state: ThumbnailStateSchema,
	imageUrl: v.nullable(v.string())
});

const RobloxThumbnailResponseSchema = v.object({
	data: v.array(RobloxThumbnailItemSchema)
});

const RobloxUserBasicSchema = v.object({
	id: v.number(),
	name: v.string(),
	displayName: v.string()
});

const RobloxUsersByIdResponseSchema = v.object({
	data: v.array(RobloxUserBasicSchema)
});

const RobloxAvatarThumbnailResponseSchema = v.object({
	data: v.array(
		v.object({
			state: v.string(),
			imageUrl: v.nullable(v.string())
		})
	)
});

const Vector3Schema = v.object({
	x: v.number(),
	y: v.number(),
	z: v.number()
});

const Roblox3DApiResponseSchema = v.object({
	targetId: v.number(),
	state: ThumbnailStateSchema,
	imageUrl: v.nullable(v.string()),
	version: v.string()
});

const Roblox3DMetadataRawSchema = v.object({
	camera: v.object({
		position: Vector3Schema,
		direction: Vector3Schema,
		fov: v.number()
	}),
	aabb: v.object({
		min: Vector3Schema,
		max: Vector3Schema
	}),
	mtl: v.string(),
	obj: v.string(),
	textures: v.array(v.string())
});

const RolesApiResponseSchema = v.object({
	groupId: v.number(),
	roles: v.array(
		v.object({
			id: v.number(),
			name: v.string(),
			rank: v.number(),
			memberCount: v.number()
		})
	)
});

const GroupErrorBodySchema = v.object({
	errors: v.optional(v.array(v.object({ code: v.number() })))
});

const MembersResponseSchema = v.object({
	data: v.array(
		v.object({
			userId: v.number(),
			username: v.string(),
			displayName: v.string(),
			hasVerifiedBadge: v.boolean()
		})
	),
	previousPageCursor: v.nullable(v.string()),
	nextPageCursor: v.nullable(v.string())
});

const UserPresencesResponseSchema = v.object({
	userPresences: v.array(
		v.object({
			userPresenceType: v.number(),
			lastLocation: v.string(),
			userId: v.number()
		})
	)
});

const GroupThumbnailBatchResponseSchema = v.object({
	data: v.array(
		v.object({
			targetId: v.number(),
			state: v.string(),
			imageUrl: v.nullable(v.string())
		})
	)
});

export type GroupRole = v.InferOutput<typeof RolesApiResponseSchema>['roles'][number];
export type GroupMember = v.InferOutput<typeof MembersResponseSchema>['data'][number];
export type MembersResponse = v.InferOutput<typeof MembersResponseSchema>;
export type UserPresence = v.InferOutput<
	typeof UserPresencesResponseSchema
>['userPresences'][number];

export const parseRobloxOutfitsResponse = v.parser(RobloxOutfitsResponseSchema);
export const parseRobloxThumbnailResponse = v.parser(RobloxThumbnailResponseSchema);
export const parseRobloxUserBasic = v.parser(RobloxUserBasicSchema);
export const parseRobloxUsersByIdResponse = v.parser(RobloxUsersByIdResponseSchema);
export const parseRobloxAvatarThumbnail = v.parser(RobloxAvatarThumbnailResponseSchema);
export const parseRoblox3DApiResponse = v.parser(Roblox3DApiResponseSchema);
export const parseRoblox3DMetadataRaw = v.parser(Roblox3DMetadataRawSchema);
export const parseRolesApiResponse = v.parser(RolesApiResponseSchema);
export const parseGroupErrorBody = v.parser(GroupErrorBodySchema);
export const parseMembersResponse = v.parser(MembersResponseSchema);
export const parseUserPresencesResponse = v.parser(UserPresencesResponseSchema);
export const parseGroupThumbnailBatchResponse = v.parser(GroupThumbnailBatchResponseSchema);
