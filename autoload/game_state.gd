extends Node

const SAVE_PATH := "user://office_slacker_save.cfg"

var audio_offset_ms: float = 0.0
var best_rank: String = ""
var best_accuracy: float = 0.0
var best_combo: int = 0
var has_perfect_medal: bool = false


func _ready() -> void:
	load_data()


func load_data() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	audio_offset_ms = float(cfg.get_value("settings", "audio_offset_ms", 0.0))
	best_rank = str(cfg.get_value("record", "rank", ""))
	best_accuracy = float(cfg.get_value("record", "accuracy", 0.0))
	best_combo = int(cfg.get_value("record", "combo", 0))
	has_perfect_medal = bool(cfg.get_value("record", "perfect_medal", false))


func save_data() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("settings", "audio_offset_ms", audio_offset_ms)
	cfg.set_value("record", "rank", best_rank)
	cfg.set_value("record", "accuracy", best_accuracy)
	cfg.set_value("record", "combo", best_combo)
	cfg.set_value("record", "perfect_medal", has_perfect_medal)
	cfg.save(SAVE_PATH)


func update_record(accuracy: float, max_combo: int, miss_count: int) -> String:
	var rank := compute_rank(accuracy)
	if accuracy > best_accuracy:
		best_accuracy = accuracy
		best_rank = rank
	if max_combo > best_combo:
		best_combo = max_combo
	if miss_count == 0 and accuracy >= 95.0:
		has_perfect_medal = true
	save_data()
	return rank


static func compute_rank(accuracy: float) -> String:
	if accuracy >= 85.0:
		return "按时下班! Superb"
	elif accuracy >= 60.0:
		return "勉强打卡 OK"
	else:
		return "通宵加班 Try Again"
