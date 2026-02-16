import { Global, Module } from '@nestjs/common';
import { SupabaseAdminService } from './supabase-admin.service';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
	providers: [SupabaseAdminService, AdminGuard],
	exports: [SupabaseAdminService, AdminGuard],
})
export class CommonModule {}
