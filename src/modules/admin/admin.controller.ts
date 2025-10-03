import { Controller, Post } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
	constructor(private readonly admin: AdminService) {}

	@Post('reset')
	async reset() {
		return this.admin.resetDatabase();
	}
}
