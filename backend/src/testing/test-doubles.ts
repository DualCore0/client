/**
 * Shared test doubles. Keeps unit tests free of a live database and network
 * calls while still letting them exercise real service logic.
 */

function modelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;

/** A PrismaService-shaped object whose methods are all vi.fn() spies. */
export function createPrismaMock() {
  return {
    user: modelMock(),
    room: modelMock(),
    roomMember: modelMock(),
    document: modelMock(),
    test: modelMock(),
    question: modelMock(),
    submission: modelMock(),
    answer: modelMock(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  };
}

/** Minimal ConfigService stand-in backed by a plain object. */
export function createConfigMock(values: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

/** Minimal JwtService stand-in. */
export function createJwtMock() {
  return {
    signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
    sign: vi.fn().mockReturnValue('signed.jwt.token'),
    verifyAsync: vi.fn(),
  };
}
