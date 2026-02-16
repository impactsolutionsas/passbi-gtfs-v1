import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  const makeService = (prismaMock: any) => {
    const cacheStub: any = {
      generateCacheKey: jest.fn().mockReturnValue('test-key'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const scoringStub: any = {};
    const learningStub: any = {};
    return new RoutingService(prismaMock, cacheStub, scoringStub, learningStub);
  };

  it('bfsConstrainedByRoute finds a path for a single route', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([
        { from_node: 1, to_node: 2 },
        { from_node: 2, to_node: 3 }
      ])
    };

    const svc = makeService(prisma);
    const result = await (svc as any).bfsConstrainedByRoute([1], new Set([3]), 'R1');
    expect(result).toEqual([1, 2, 3]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it('bfsWithTransferLimit allows limited transfers', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([
        { from_node: 1, to_node: 2, route_id: 'A' },
        { from_node: 2, to_node: 3, route_id: 'B' },
        { from_node: 3, to_node: 4, route_id: 'B' }
      ])
    };

    const svc = makeService(prisma);
    const path = await (svc as any).bfsWithTransferLimit([1], [4], 1);
    expect(path).toEqual([1, 2, 3, 4]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it('route returns walk-only for short distances', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    const svc = makeService(prisma);
    const result = await svc.route({
      fromLat: 14.6937,
      fromLon: -17.4441,
      toLat: 14.6938,
      toLon: -17.4440,
    });

    expect(result.walkOnly).toBe(true);
    expect(result.distance_m).toBeLessThan(500);
  });

  it('haversineDistance calculates correct distance', () => {
    const svc = makeService({});
    const distance = (svc as any).haversineDistance(14.6937, -17.4441, 14.7037, -17.4341);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(2000);
  });
});
