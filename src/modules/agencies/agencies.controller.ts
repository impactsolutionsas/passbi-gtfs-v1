import { Controller, Get } from '@nestjs/common';
import { AgenciesService, AgencyInfo } from './agencies.service';

@Controller('agencies')
export class AgenciesController {
	constructor(private readonly agenciesService: AgenciesService) {}

	@Get()
	async listAgencies(): Promise<{ agencies: AgencyInfo[] }> {
		return this.agenciesService.listAgencies();
	}
}
