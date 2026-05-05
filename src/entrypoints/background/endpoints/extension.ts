import type {
	MembershipBadgeUpdatePayload,
	MembershipStatus,
	MembershipVerificationChallenge
} from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import {
	parseMembershipStatus,
	parseMembershipVerificationChallenge
} from '@/lib/schemas/rotector';
import { makeHttpRequest } from '../http-client';

export async function getMembershipStatus(): Promise<MembershipStatus> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.EXTENSION_MEMBERSHIP_STATUS, {
		method: 'GET',
		parse: parseMembershipStatus
	});
}

// Partial update: any combination of badgeDesign / iconDesign / textDesign
// Absent fields retain their current server-side values
export async function updateMembershipBadge(
	payload: MembershipBadgeUpdatePayload
): Promise<MembershipStatus> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.EXTENSION_MEMBERSHIP_BADGE, {
		method: 'POST',
		body: JSON.stringify(payload),
		parse: parseMembershipStatus
	});
}

// Clear the Roblox association as design values are preserved server-side until re-assigned
export async function clearMembershipBadge(): Promise<MembershipStatus> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.EXTENSION_MEMBERSHIP_BADGE, {
		method: 'DELETE',
		parse: parseMembershipStatus
	});
}

// Issue the deterministic verification phrase the member must paste into their Roblox bio
export async function getMembershipVerification(
	robloxUserId: number
): Promise<MembershipVerificationChallenge> {
	const url = `${API_CONFIG.ENDPOINTS.EXTENSION_MEMBERSHIP_VERIFICATION}?robloxUserId=${String(robloxUserId)}`;
	return makeHttpRequest(url, {
		method: 'GET',
		maxRetries: 1,
		parse: parseMembershipVerificationChallenge
	});
}

// Verify the phrase is in the bio so on success the server links the Roblox ID and returns the new status
export async function confirmMembershipVerification(
	robloxUserId: number
): Promise<MembershipStatus> {
	return makeHttpRequest(API_CONFIG.ENDPOINTS.EXTENSION_MEMBERSHIP_VERIFICATION, {
		method: 'POST',
		body: JSON.stringify({ robloxUserId }),
		maxRetries: 1,
		parse: parseMembershipStatus
	});
}
