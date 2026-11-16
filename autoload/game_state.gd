extends Node

const SAVE_PATH := "user://rhythm_mini_save.cfg"

var audio_offset_ms: float = 0.0

# Stage definitions
const STAGES := [
	{
		"id": "forge",
		"title": "铁匠打铁",
		"subtitle": "Forge Beat",
		"bpm": 115.0,
		"description": "听师傅打铁的节奏！\n普通拍：师傅敲1下，你跟敲1下。\n三连敲：叮-叮-叮 后紧跟三连击！",
		"scene_path": "res://scenes/stage_forge.tscn",
		"accent": Color(0.98, 0.48, 0.22),
	},
	{
		"id": "factory",
		"title": "流水线接球",
		"subtitle": "Factory Catch",
		"bpm": 120.0,
		"description": "盯紧传送带上的零件！\n普通件：1 - 2 - 3 - 【抓！】\n金色加速件：哔哔 - 【快抓！】",
		"scene_path": "res://scenes/stage_factory.tscn",
		"accent": Color(0.24, 0.76, 0.96),
	},
	{
		"id": "choir",
		"title": "合唱团点名",
		"subtitle": "Choir Snap",
		"bpm": 108.0,
		"description": "你是站在最右边的小合唱员！\n听指挥或队友点名：1 - 2 - 3 - 【轮到你！】\n注意齐唱信号：一起——【嘿！】",
		"scene_path": "res://scenes/stage_choir.tscn",
		"accent": Color(0.95, 0.35, 0.58),
	},
]

# stage_id -> { "rank": String, "accuracy": float }
var best_records: Dictionary = {}


func _ready() -> void:
	load_data()


func load_data() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	audio_offset_ms = float(cfg.get_value("settings", "audio_offset_ms", 0.0))
	for stage in STAGES:
		var sid: String = stage["id"]
		var rank: String = str(cfg.get_value("records", sid + "_rank", ""))
		var acc: float = float(cfg.get_value("records", sid + "_acc", 0.0))
		if rank != "":
			best_records[sid] = {"rank": rank, "accuracy": acc}


func save_data() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("settings", "audio_offset_ms", audio_offset_ms)
	for sid in best_records.keys():
		cfg.set_value("records", sid + "_rank", best_records[sid]["rank"])
		cfg.set_value("records", sid + "_acc", best_records[sid]["accuracy"])
	cfg.save(SAVE_PATH)


func update_record(stage_id: String, rank: String, accuracy: float) -> void:
	var prev: Dictionary = best_records.get(stage_id, {"rank": "", "accuracy": -1.0})
	if accuracy > float(prev["accuracy"]):
		best_records[stage_id] = {"rank": rank, "accuracy": accuracy}
		save_data()


static func compute_rank(accuracy: float) -> String:
	if accuracy >= 85.0:
		return "超棒! Superb"
	elif accuracy >= 60.0:
		return "合格 OK"
	else:
		return "再试试 Try Again"
