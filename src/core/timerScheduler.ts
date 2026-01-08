import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';

type TimerCallback = () => void | Promise<void>;

export class TimerScheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private paused = false;

  /**
   * ランダム間隔でコールバックをスケジュール
   */
  scheduleRandomInterval(
    id: string,
    callback: TimerCallback,
    minMs: number = CONSTANTS.DEFAULT_SYNC_INTERVAL_MIN,
    maxMs: number = CONSTANTS.DEFAULT_SYNC_INTERVAL_MAX
  ): void {
    // 既存のタイマーをクリア
    this.clearTimer(id);

    const interval = this.getRandomInterval(minMs, maxMs);
    logger.debug(`Scheduling timer '${id}' with interval: ${interval}ms`);

    const timerId = setTimeout(async () => {
      if (this.paused) {
        logger.debug(`Timer '${id}' fired but system is paused, rescheduling`);
        this.scheduleRandomInterval(id, callback, minMs, maxMs);
        return;
      }

      try {
        logger.debug(`Timer '${id}' fired, executing callback`);
        await callback();
      } catch (error) {
        logger.error(`Error in timer callback '${id}'`, error as Error);
      }

      // 再スケジュール（次回もランダム間隔）
      if (this.timers.has(id)) {
        this.scheduleRandomInterval(id, callback, minMs, maxMs);
      }
    }, interval);

    this.timers.set(id, timerId);
  }

  /**
   * 一度だけ実行するタイマーをスケジュール
   */
  scheduleOnce(
    id: string,
    callback: TimerCallback,
    delayMs: number
  ): void {
    // 既存のタイマーをクリア
    this.clearTimer(id);

    logger.debug(`Scheduling one-time timer '${id}' with delay: ${delayMs}ms`);

    const timerId = setTimeout(async () => {
      if (this.paused) {
        logger.debug(`Timer '${id}' fired but system is paused, skipping`);
        return;
      }

      try {
        logger.debug(`Timer '${id}' fired, executing callback`);
        await callback();
      } catch (error) {
        logger.error(`Error in timer callback '${id}'`, error as Error);
      }

      // 実行後にタイマーを削除
      this.timers.delete(id);
    }, delayMs);

    this.timers.set(id, timerId);
  }

  /**
   * ランダム間隔を生成
   */
  private getRandomInterval(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * 特定のタイマーをクリア
   */
  clearTimer(id: string): void {
    const timerId = this.timers.get(id);
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(id);
      logger.debug(`Timer '${id}' cleared`);
    }
  }

  /**
   * 全てのタイマーをクリア
   */
  clearAll(): void {
    this.timers.forEach((timerId, id) => {
      clearTimeout(timerId);
      logger.debug(`Timer '${id}' cleared`);
    });
    this.timers.clear();
    logger.info('All timers cleared');
  }

  /**
   * タイマーを一時停止
   */
  pause(): void {
    this.paused = true;
    logger.info('Timer scheduler paused');
  }

  /**
   * タイマーを再開
   */
  resume(): void {
    this.paused = false;
    logger.info('Timer scheduler resumed');
  }

  /**
   * 一時停止状態を取得
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * アクティブなタイマーの数を取得
   */
  getActiveTimerCount(): number {
    return this.timers.size;
  }

  /**
   * アクティブなタイマーのIDリストを取得
   */
  getActiveTimerIds(): string[] {
    return Array.from(this.timers.keys());
  }
}
