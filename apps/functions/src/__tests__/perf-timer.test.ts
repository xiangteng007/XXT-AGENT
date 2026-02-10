/**
 * Unit Tests: Performance Timer (V3 Audit #18)
 */

jest.mock('firebase-functions/v2', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { withTimer, createTimer } from '../utils/perf-timer';
import { logger } from 'firebase-functions/v2';

describe('Performance Timer', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('withTimer', () => {
        it('should measure successful operations', async () => {
            const result = await withTimer('test.op', async () => {
                return 42;
            });

            expect(result).toBe(42);
            expect(logger.info).toHaveBeenCalledWith('perf_metric', expect.objectContaining({
                operation: 'test.op',
                status: 'success',
                duration_ms: expect.any(Number),
            }));
        });

        it('should log errors and re-throw', async () => {
            await expect(
                withTimer('test.fail', async () => { throw new Error('boom'); })
            ).rejects.toThrow('boom');

            expect(logger.error).toHaveBeenCalledWith('perf_metric', expect.objectContaining({
                operation: 'test.fail',
                status: 'error',
                error: 'boom',
            }));
        });

        it('should pass metadata through', async () => {
            await withTimer('test.meta', async () => 'ok', { userId: '123' });
            expect(logger.info).toHaveBeenCalledWith('perf_metric', expect.objectContaining({
                userId: '123',
            }));
        });
    });

    describe('createTimer', () => {
        it('should measure elapsed time', async () => {
            const timer = createTimer();
            await new Promise(r => setTimeout(r, 10));
            expect(timer.elapsed()).toBeGreaterThanOrEqual(5);
        });

        it('should log on stop', () => {
            const timer = createTimer();
            const ms = timer.stop('test.manual');
            expect(ms).toBeGreaterThanOrEqual(0);
            expect(logger.info).toHaveBeenCalledWith('perf_metric', expect.objectContaining({
                operation: 'test.manual',
            }));
        });
    });
});
