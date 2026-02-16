import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export enum UserRole {
	SUPER_ADMIN = 'SUPER_ADMIN',
	ADMIN = 'ADMIN',
	VIEWER = 'VIEWER',
}

export interface AdminUser {
	id: string;
	email?: string;
	role: UserRole;
}

@Injectable()
export class SupabaseAdminService implements OnModuleInit {
	private readonly logger = new Logger(SupabaseAdminService.name);
	private supabaseAdmin?: SupabaseClient;
	private supabasePublic?: SupabaseClient;

	onModuleInit() {
		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

		if (!supabaseUrl) {
			this.logger.warn('SUPABASE_URL not set, Supabase admin features will be disabled');
			return;
		}

		if (supabaseServiceKey) {
			this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			});
			this.logger.log('Supabase admin client initialized');
		}

		if (supabaseAnonKey) {
			this.supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
			this.logger.log('Supabase public client initialized');
		}
	}

	/**
	 * Get admin client for service_role operations
	 */
	getAdminClient(): SupabaseClient {
		if (!this.supabaseAdmin) {
			throw new Error('Supabase admin client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
		}
		return this.supabaseAdmin;
	}

	/**
	 * Get public client for user operations
	 */
	getPublicClient(): SupabaseClient {
		if (!this.supabasePublic) {
			throw new Error('Supabase public client not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY');
		}
		return this.supabasePublic;
	}

	/**
	 * Verify JWT token and extract user info
	 */
	async verifyToken(token: string): Promise<AdminUser | null> {
		try {
			const publicClient = this.getPublicClient();
			const { data: { user }, error } = await publicClient.auth.getUser(token);

			if (error || !user) {
				this.logger.warn(`Token verification failed: ${error?.message}`);
				return null;
			}

			// Get user role from user metadata or a separate user_roles table
			// For now, we'll use metadata.role or default to VIEWER
			const role = (user.user_metadata?.role as UserRole) || UserRole.VIEWER;

			return {
				id: user.id,
				email: user.email,
				role,
			};
		} catch (error: any) {
			this.logger.error(`Error verifying token: ${error?.message || 'Unknown error'}`);
			return null;
		}
	}

	/**
	 * Check if user has required role
	 */
	hasRole(user: AdminUser, requiredRole: UserRole): boolean {
		const roleHierarchy = {
			[UserRole.SUPER_ADMIN]: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEWER],
			[UserRole.ADMIN]: [UserRole.ADMIN, UserRole.VIEWER],
			[UserRole.VIEWER]: [UserRole.VIEWER],
		};

		return roleHierarchy[user.role]?.includes(requiredRole) || false;
	}
}
