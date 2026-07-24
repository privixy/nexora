use super::super::ProgressEmitter;

#[test]
fn progress_interval_and_finish_behavior_is_preserved() {
    let mut emitted = Vec::new();
    {
        let mut progress = ProgressEmitter::new(3, |count| emitted.push(count));
        for _ in 0..7 {
            progress.tick();
        }
        assert_eq!(progress.count(), 7);
        progress.finish();
    }
    assert_eq!(emitted, vec![3, 6, 7]);
}

#[test]
fn zero_interval_is_normalized_to_one() {
    let mut emitted = Vec::new();
    {
        let mut progress = ProgressEmitter::new(0, |count| emitted.push(count));
        progress.tick();
        progress.tick();
    }
    assert_eq!(emitted, vec![1, 2]);
}
