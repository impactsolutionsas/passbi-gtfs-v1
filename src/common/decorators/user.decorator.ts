import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '../supabase-admin.service';

export const CurrentUser = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): AdminUser => {
		const request = ctx.switchToHttp().getRequest();
		return request.user;
	},
);
