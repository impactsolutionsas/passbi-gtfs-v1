import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseAdminService, UserRole } from '../supabase-admin.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private supabaseAdmin: SupabaseAdminService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new UnauthorizedException('Missing or invalid authorization header');
		}

		const token = authHeader.substring(7);
		const user = await this.supabaseAdmin.verifyToken(token);

		if (!user) {
			throw new UnauthorizedException('Invalid or expired token');
		}

		// Attach user to request
		request.user = user;

		// Check roles if specified
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (requiredRoles && requiredRoles.length > 0) {
			const hasRequiredRole = requiredRoles.some(role => 
				this.supabaseAdmin.hasRole(user, role)
			);

			if (!hasRequiredRole) {
				throw new ForbiddenException(`Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`);
			}
		}

		return true;
	}
}
