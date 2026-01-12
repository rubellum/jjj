import * as assert from 'assert';
import * as sinon from 'sinon';
import { TimerScheduler } from '../../../core/timerScheduler';

suite('TimerScheduler Test Suite', () => {
  let scheduler: TimerScheduler;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    scheduler = new TimerScheduler();
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    scheduler.clearAll();
    clock.restore();
    sinon.restore();
  });

  suite('scheduleOnce', () => {
    test('指定時間後にコールバックを実行', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);

      assert.strictEqual(callback.callCount, 0);

      await clock.tickAsync(1000);

      assert.strictEqual(callback.callCount, 1);
    });

    test('タイマー実行後に自動削除', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);
      await clock.tickAsync(1000);

      assert.strictEqual(scheduler.getActiveTimerCount(), 0);
      assert.ok(!scheduler.getActiveTimerIds().includes('test-timer'));
    });

    test('同じIDで再スケジュールすると前のタイマーをクリア', async () => {
      const callback1 = sinon.stub().resolves();
      const callback2 = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback1, 1000);
      scheduler.scheduleOnce('test-timer', callback2, 500);

      await clock.tickAsync(500);

      assert.strictEqual(callback1.callCount, 0, 'first callback should not be called');
      assert.strictEqual(callback2.callCount, 1, 'second callback should be called');
    });

    test('pause中はコールバックをスキップ', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);
      scheduler.pause();

      await clock.tickAsync(1000);

      assert.strictEqual(callback.callCount, 0);
    });

    test('resume後は新しいタイマーが実行される', async () => {
      const callback = sinon.stub().resolves();

      scheduler.pause();
      scheduler.scheduleOnce('test-timer', callback, 500);

      await clock.tickAsync(500);
      assert.strictEqual(callback.callCount, 0);

      scheduler.resume();
      scheduler.scheduleOnce('test-timer2', callback, 500);
      await clock.tickAsync(500);

      assert.strictEqual(callback.callCount, 1);
    });

    test('コールバック内でエラーが発生してもクラッシュしない', async () => {
      const callback = sinon.stub().rejects(new Error('test error'));

      scheduler.scheduleOnce('test-timer', callback, 1000);

      await assert.doesNotReject(async () => {
        await clock.tickAsync(1000);
      });

      assert.strictEqual(callback.callCount, 1);
      assert.strictEqual(scheduler.getActiveTimerCount(), 0);
    });

    test('複数のタイマーを並行して実行', async () => {
      const callback1 = sinon.stub().resolves();
      const callback2 = sinon.stub().resolves();
      const callback3 = sinon.stub().resolves();

      scheduler.scheduleOnce('timer1', callback1, 1000);
      scheduler.scheduleOnce('timer2', callback2, 1500);
      scheduler.scheduleOnce('timer3', callback3, 500);

      await clock.tickAsync(500);
      assert.strictEqual(callback3.callCount, 1);

      await clock.tickAsync(500);
      assert.strictEqual(callback1.callCount, 1);

      await clock.tickAsync(500);
      assert.strictEqual(callback2.callCount, 1);
    });
  });

  suite('scheduleRandomInterval', () => {
    test('指定範囲内の間隔でコールバックを実行', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleRandomInterval('test-timer', callback, 100, 200);

      await clock.tickAsync(250); // 最大値+余裕まで進める

      assert.strictEqual(callback.callCount, 1);
    });

    test('実行後に自動的に再スケジュール', async () => {
      const callback = sinon.stub().resolves();

      // 固定間隔でテスト
      scheduler.scheduleRandomInterval('test-timer', callback, 100, 100);

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 1);

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 2);

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 3);
    });

    test('pause中は再スケジュールのみ実行（コールバックスキップ）', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleRandomInterval('test-timer', callback, 100, 100);
      scheduler.pause();

      await clock.tickAsync(100);

      assert.strictEqual(callback.callCount, 0, 'callback should not be called when paused');
      assert.strictEqual(scheduler.getActiveTimerCount(), 1, 'timer should still be active');
    });

    test('pause中に発火したタイマーはresume後も再スケジュールされる', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleRandomInterval('test-timer', callback, 100, 100);
      scheduler.pause();

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 0);

      scheduler.resume();
      await clock.tickAsync(100);

      assert.strictEqual(callback.callCount, 1);
    });

    test('clearTimerで停止すると再スケジュールしない', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleRandomInterval('test-timer', callback, 100, 100);

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 1);

      scheduler.clearTimer('test-timer');

      await clock.tickAsync(100);
      assert.strictEqual(callback.callCount, 1, 'should not reschedule after clear');
    });

    test('コールバック内でエラーが発生しても再スケジュールは続く', async () => {
      let callCount = 0;
      const callback = sinon.stub().callsFake(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('test error');
        }
      });

      scheduler.scheduleRandomInterval('test-timer', callback, 100, 100);

      await clock.tickAsync(100);
      assert.strictEqual(callCount, 1);

      await clock.tickAsync(100);
      assert.strictEqual(callCount, 2, 'should continue rescheduling after error');
    });

    test('同じIDで再スケジュールすると前のタイマーをクリア', async () => {
      const callback1 = sinon.stub().resolves();
      const callback2 = sinon.stub().resolves();

      scheduler.scheduleRandomInterval('test-timer', callback1, 1000, 1000);
      scheduler.scheduleRandomInterval('test-timer', callback2, 500, 500);

      await clock.tickAsync(500);

      assert.strictEqual(callback1.callCount, 0);
      assert.strictEqual(callback2.callCount, 1);
    });
  });

  suite('clearTimer', () => {
    test('特定のタイマーをクリア', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);
      scheduler.clearTimer('test-timer');

      await clock.tickAsync(1000);

      assert.strictEqual(callback.callCount, 0);
      assert.strictEqual(scheduler.getActiveTimerCount(), 0);
    });

    test('存在しないタイマーをクリアしてもエラーにならない', () => {
      assert.doesNotThrow(() => {
        scheduler.clearTimer('non-existent-timer');
      });
    });

    test('clearTimer後に再度スケジュールできる', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);
      scheduler.clearTimer('test-timer');
      scheduler.scheduleOnce('test-timer', callback, 500);

      await clock.tickAsync(500);

      assert.strictEqual(callback.callCount, 1);
    });
  });

  suite('clearAll', () => {
    test('全てのタイマーをクリア', async () => {
      const callback1 = sinon.stub().resolves();
      const callback2 = sinon.stub().resolves();

      scheduler.scheduleOnce('timer1', callback1, 1000);
      scheduler.scheduleOnce('timer2', callback2, 1000);

      assert.strictEqual(scheduler.getActiveTimerCount(), 2);

      scheduler.clearAll();

      assert.strictEqual(scheduler.getActiveTimerCount(), 0);

      await clock.tickAsync(1000);

      assert.strictEqual(callback1.callCount, 0);
      assert.strictEqual(callback2.callCount, 0);
    });

    test('タイマーがない状態でclearAllしてもエラーにならない', () => {
      assert.doesNotThrow(() => {
        scheduler.clearAll();
      });
    });
  });

  suite('pause/resume', () => {
    test('pauseとresumeが正しく動作', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000);

      scheduler.pause();
      assert.strictEqual(scheduler.isPaused(), true);

      await clock.tickAsync(1000);
      assert.strictEqual(callback.callCount, 0);

      scheduler.resume();
      assert.strictEqual(scheduler.isPaused(), false);

      scheduler.scheduleOnce('test-timer2', callback, 500);
      await clock.tickAsync(500);
      assert.strictEqual(callback.callCount, 1);
    });

    test('複数回pauseしても問題ない', () => {
      scheduler.pause();
      scheduler.pause();
      assert.strictEqual(scheduler.isPaused(), true);
    });

    test('複数回resumeしても問題ない', () => {
      scheduler.pause();
      scheduler.resume();
      scheduler.resume();
      assert.strictEqual(scheduler.isPaused(), false);
    });
  });

  suite('getActiveTimerCount', () => {
    test('アクティブなタイマー数を取得', () => {
      assert.strictEqual(scheduler.getActiveTimerCount(), 0);

      scheduler.scheduleOnce('timer1', sinon.stub(), 1000);
      assert.strictEqual(scheduler.getActiveTimerCount(), 1);

      scheduler.scheduleOnce('timer2', sinon.stub(), 1000);
      assert.strictEqual(scheduler.getActiveTimerCount(), 2);

      scheduler.clearTimer('timer1');
      assert.strictEqual(scheduler.getActiveTimerCount(), 1);

      scheduler.clearAll();
      assert.strictEqual(scheduler.getActiveTimerCount(), 0);
    });
  });

  suite('getActiveTimerIds', () => {
    test('アクティブなタイマーのIDリストを取得', () => {
      const ids1 = scheduler.getActiveTimerIds();
      assert.strictEqual(ids1.length, 0);

      scheduler.scheduleOnce('timer1', sinon.stub(), 1000);
      scheduler.scheduleOnce('timer2', sinon.stub(), 1000);

      const ids2 = scheduler.getActiveTimerIds();
      assert.strictEqual(ids2.length, 2);
      assert.ok(ids2.includes('timer1'));
      assert.ok(ids2.includes('timer2'));

      scheduler.clearTimer('timer1');

      const ids3 = scheduler.getActiveTimerIds();
      assert.strictEqual(ids3.length, 1);
      assert.ok(ids3.includes('timer2'));
      assert.ok(!ids3.includes('timer1'));
    });
  });

  suite('エッジケース', () => {
    test('0ms遅延でも正しく動作', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 0);

      await clock.tickAsync(0);

      assert.strictEqual(callback.callCount, 1);
    });

    test('非常に長い遅延時間でも正しく動作', async () => {
      const callback = sinon.stub().resolves();

      scheduler.scheduleOnce('test-timer', callback, 1000000);

      await clock.tickAsync(1000000);

      assert.strictEqual(callback.callCount, 1);
    });

    test('同期的なコールバックも正しく動作', async () => {
      let called = false;
      const callback = () => {
        called = true;
      };

      scheduler.scheduleOnce('test-timer', callback, 1000);

      await clock.tickAsync(1000);

      assert.strictEqual(called, true);
    });
  });
});
