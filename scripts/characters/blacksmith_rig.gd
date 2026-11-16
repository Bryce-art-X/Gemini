class_name BlacksmithRig
extends Node2D

@export var is_player: bool = false
@export var facing_left: bool = false

var _body_pivot: Node2D
var _torso: Sprite2D
var _head_pivot: Node2D
var _head: Sprite2D
var _shoulder: Node2D
var _upper_arm: Sprite2D
var _elbow: Node2D
var _hammer_arm: Sprite2D
var _anim: AnimationPlayer

var _head_textures: Dictionary = {}


func _ready() -> void:
	_build_rig()
	_build_animations()
	if facing_left:
		scale.x = -1.0


func _build_rig() -> void:
	_body_pivot = Node2D.new()
	add_child(_body_pivot)

	_torso = Sprite2D.new()
	_torso.texture = load("res://assets/textures/player_torso.png" if is_player else "res://assets/textures/master_torso.png")
	_torso.position = Vector2(0, -60)
	_body_pivot.add_child(_torso)

	_head_pivot = Node2D.new()
	_head_pivot.position = Vector2(0, -110)
	_body_pivot.add_child(_head_pivot)

	if is_player:
		_head_textures["normal"] = load("res://assets/textures/player_head_normal.png")
		_head_textures["happy"] = _head_textures["normal"]
		_head_textures["confused"] = _head_textures["normal"]
		_head_textures["sideeye"] = _head_textures["normal"]
	else:
		_head_textures["normal"] = load("res://assets/textures/master_head_normal.png")
		_head_textures["happy"] = load("res://assets/textures/master_head_happy.png")
		_head_textures["confused"] = load("res://assets/textures/master_head_confused.png")
		_head_textures["sideeye"] = load("res://assets/textures/master_head_sideeye.png")

	_head = Sprite2D.new()
	_head.texture = _head_textures["normal"]
	_head.position = Vector2(0, -34)
	_head_pivot.add_child(_head)

	# Hierarchical 2-joint Hammer Arm
	_shoulder = Node2D.new()
	_shoulder.position = Vector2(18, -88)
	_body_pivot.add_child(_shoulder)

	_upper_arm = Sprite2D.new()
	_upper_arm.texture = load("res://assets/textures/arm_upper.png")
	_upper_arm.offset = Vector2(18, 0)
	_shoulder.add_child(_upper_arm)

	_elbow = Node2D.new()
	_elbow.position = Vector2(44, 0)
	_shoulder.add_child(_elbow)

	_hammer_arm = Sprite2D.new()
	_hammer_arm.texture = load("res://assets/textures/hammer_arm.png")
	_hammer_arm.offset = Vector2(28, -16)
	_elbow.add_child(_hammer_arm)

	# Default ready pose
	_shoulder.rotation_degrees = -42.0
	_elbow.rotation_degrees = -35.0


func _build_animations() -> void:
	_anim = AnimationPlayer.new()
	add_child(_anim)
	var lib := AnimationLibrary.new()

	# 1. Beat Bop (whole-beat squash & stretch + head nod)
	var bop := Animation.new()
	bop.length = 0.22
	var t_scale := bop.add_track(Animation.TYPE_VALUE)
	bop.track_set_path(t_scale, NodePath("Node2D:scale")) # resolved via _body_pivot name below
	_body_pivot.name = "BodyPivot"
	_head_pivot.name = "HeadPivot"
	_shoulder.name = "Shoulder"
	_elbow.name = "Elbow"

	bop.track_set_path(t_scale, NodePath("BodyPivot:scale"))
	bop.track_insert_key(t_scale, 0.0, Vector2(1.09, 0.91))
	bop.track_insert_key(t_scale, 0.14, Vector2(0.98, 1.02))
	bop.track_insert_key(t_scale, 0.22, Vector2(1.0, 1.0))

	var t_head := bop.add_track(Animation.TYPE_VALUE)
	bop.track_set_path(t_head, NodePath("BodyPivot/HeadPivot:rotation_degrees"))
	bop.track_insert_key(t_head, 0.0, 7.0)
	bop.track_insert_key(t_head, 0.16, 0.0)
	lib.add_animation("bop", bop)

	# 2. Strike (two-joint hammer smash + torso lean + squash)
	var strike := Animation.new()
	strike.length = 0.28
	var s_sh := strike.add_track(Animation.TYPE_VALUE)
	strike.track_set_path(s_sh, NodePath("BodyPivot/Shoulder:rotation_degrees"))
	strike.track_insert_key(s_sh, 0.0, -78.0)
	strike.track_insert_key(s_sh, 0.07, 28.0)
	strike.track_insert_key(s_sh, 0.18, -32.0)
	strike.track_insert_key(s_sh, 0.28, -42.0)

	var s_el := strike.add_track(Animation.TYPE_VALUE)
	strike.track_set_path(s_el, NodePath("BodyPivot/Shoulder/Elbow:rotation_degrees"))
	strike.track_insert_key(s_el, 0.0, -55.0)
	strike.track_insert_key(s_el, 0.07, 16.0)
	strike.track_insert_key(s_el, 0.28, -35.0)

	var s_body := strike.add_track(Animation.TYPE_VALUE)
	strike.track_set_path(s_body, NodePath("BodyPivot:rotation_degrees"))
	strike.track_insert_key(s_body, 0.0, -8.0)
	strike.track_insert_key(s_body, 0.07, 10.0)
	strike.track_insert_key(s_body, 0.28, 0.0)

	var s_sc := strike.add_track(Animation.TYPE_VALUE)
	strike.track_set_path(s_sc, NodePath("BodyPivot:scale"))
	strike.track_insert_key(s_sc, 0.0, Vector2(0.92, 1.10))
	strike.track_insert_key(s_sc, 0.07, Vector2(1.16, 0.86))
	strike.track_insert_key(s_sc, 0.28, Vector2(1.0, 1.0))
	lib.add_animation("strike", strike)

	# 3. Windup (2-beat heavy charge raise)
	var windup := Animation.new()
	windup.length = 0.45
	var w_sh := windup.add_track(Animation.TYPE_VALUE)
	windup.track_set_path(w_sh, NodePath("BodyPivot/Shoulder:rotation_degrees"))
	windup.track_insert_key(w_sh, 0.0, -42.0)
	windup.track_insert_key(w_sh, 0.35, -115.0)

	var w_el := windup.add_track(Animation.TYPE_VALUE)
	windup.track_set_path(w_el, NodePath("BodyPivot/Shoulder/Elbow:rotation_degrees"))
	windup.track_insert_key(w_el, 0.0, -35.0)
	windup.track_insert_key(w_el, 0.35, -55.0)

	var w_bd := windup.add_track(Animation.TYPE_VALUE)
	windup.track_set_path(w_bd, NodePath("BodyPivot:rotation_degrees"))
	windup.track_insert_key(w_bd, 0.0, 0.0)
	windup.track_insert_key(w_bd, 0.35, -12.0)
	lib.add_animation("windup", windup)

	_anim.add_animation_library("", lib)


func play_bop() -> void:
	if not _anim.is_playing():
		_anim.play("bop")


func play_strike() -> void:
	_anim.stop()
	_anim.play("strike")


func play_windup() -> void:
	_anim.stop()
	_anim.play("windup")


func set_mood(mood: String) -> void:
	if _head_textures.has(mood):
		_head.texture = _head_textures[mood]
	else:
		_head.texture = _head_textures["normal"]
