import { 
	Controller, 
	Get, 
	Post, 
	Put, 
	Delete, 
	Body, 
	Param, 
	ParseIntPipe 
} from '@nestjs/common';
import { VtcService } from './vtc.service';
import { CreateVtcConfigDto, UpdateVtcConfigDto } from './dto/vtc-config.dto';

@Controller('vtc')
export class VtcController {
	constructor(private readonly vtcService: VtcService) {}

	@Get('configs')
	async getAllConfigs() {
		return this.vtcService.getAllConfigs();
	}

	@Post('configs')
	async createConfig(@Body() dto: CreateVtcConfigDto) {
		return this.vtcService.createConfig(dto);
	}

	@Put('configs/:id')
	async updateConfig(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateVtcConfigDto
	) {
		return this.vtcService.updateConfig(id, dto);
	}

	@Delete('configs/:id')
	async deleteConfig(@Param('id', ParseIntPipe) id: number) {
		return this.vtcService.deleteConfig(id);
	}
}
