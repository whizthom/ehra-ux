import { useMemo, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import { uploadAttachment } from "../../api/messagingApi";
import styles from "./MessageComposer.module.css";

const MAX_ATTACHMENT_HINT = {
  IMAGE: "image/*",
  DOCUMENT: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip",
};

export default function MessageComposer({
  replyTo,
  onCancelReply,
  onSend,
  onTypingKeystroke,
  onStopTyping,
  groupMembers, // for @mentions, undefined for DIRECT
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}) {
  const [text, setText] = useState(editingMessage?.body || "");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);

  const isEditing = Boolean(editingMessage);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !groupMembers) return [];
    const q = mentionQuery.toLowerCase();
    return groupMembers
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, groupMembers]);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (!isEditing) onTypingKeystroke();

    if (groupMembers) {
      const upToCursor = value.slice(0, e.target.selectionStart);
      const match = upToCursor.match(/(?:^|\s)@([\w-]*)$/);
      setMentionQuery(match ? match[1] : null);
    }
  };

  const insertMention = (member) => {
    const el = textareaRef.current;
    const cursor = el.selectionStart;
    const before = text
      .slice(0, cursor)
      .replace(/@([\w-]*)$/, `@${member.name.split(" ")[0]} `);
    const after = text.slice(cursor);
    setText(before + after);
    setMentionQuery(null);
    el.focus();
  };

  const resetAfterSend = () => {
    setText("");
    onStopTyping();
    onCancelReply?.();
  };

  const submitText = async () => {
    const body = text.trim();
    if (!body) return;
    if (isEditing) {
      await onSaveEdit(editingMessage.id, body);
      setText("");
      return;
    }
    const mentionIds = groupMembers
      ? groupMembers
          .filter((m) => body.includes(`@${m.name.split(" ")[0]}`))
          .map((m) => m.identityId)
      : undefined;
    await onSend({
      messageType: "TEXT",
      body,
      replyToMessageId: replyTo?.id,
      replyToPreview: replyTo
        ? {
            messageId: replyTo.id,
            senderIdentityId: replyTo.senderIdentityId,
            senderName: replyTo.senderName,
            snippet: replyTo.body?.slice(0, 120),
          }
        : undefined,
      mentions: mentionIds,
    });
    resetAfterSend();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !mentionCandidates.length) {
      e.preventDefault();
      submitText();
    }
  };

  const handleFilePicked = async (file, kind) => {
    if (!file) return;
    setShowAttachMenu(false);
    setUploading(true);
    setUploadError(null);
    try {
      const { data } = await uploadAttachment(file, kind);
      await onSend({
        messageType: kind,
        body: null,
        metadata: {
          url: data.url,
          fileName: data.fileName,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
        },
        replyToMessageId: replyTo?.id,
      });
      onCancelReply?.();
    } catch {
      setUploadError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceSend = async (blob, seconds) => {
    setRecording(false);
    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: blob.type || "audio/webm",
    });
    setUploading(true);
    try {
      const { data } = await uploadAttachment(file, "VOICE");
      await onSend({
        messageType: "VOICE",
        metadata: {
          url: data.url,
          fileName: data.fileName,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
          durationSeconds: seconds,
        },
        replyToMessageId: replyTo?.id,
      });
      onCancelReply?.();
    } catch {
      setUploadError("Voice message failed to send.");
    } finally {
      setUploading(false);
    }
  };

  const handleShareLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      setUploadError("Location isn't available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await onSend({
          messageType: "LOCATION",
          metadata: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: "My location",
          },
          replyToMessageId: replyTo?.id,
        });
        onCancelReply?.();
      },
      () => setUploadError("Couldn't get your location."),
    );
  };

  if (recording) {
    return (
      <div className={styles.composerWrap}>
        <VoiceRecorder
          onCancel={() => setRecording(false)}
          onSend={handleVoiceSend}
        />
      </div>
    );
  }

  return (
    <div className={styles.composerWrap}>
      {(replyTo || isEditing) && (
        <div className={styles.replyBar}>
          <div className={styles.replyBarInfo}>
            <span className={styles.replyBarLabel}>
              {isEditing
                ? "Editing message"
                : `Replying to ${replyTo.senderName}`}
            </span>
            <span className={styles.replyBarSnippet}>
              {isEditing ? editingMessage.body : replyTo.body?.slice(0, 100)}
            </span>
          </div>
          <button onClick={isEditing ? onCancelEdit : onCancelReply}>
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      {uploadError && <div className={styles.uploadError}>{uploadError}</div>}

      <div className={styles.inputRow}>
        {!isEditing && (
          <button
            className={`${styles.iconBtn} ${showAttachMenu ? styles.iconBtnActive : ""}`}
            onClick={() => setShowAttachMenu((v) => !v)}
            title="Attach"
            disabled={uploading}
          >
            <i className={showAttachMenu ? "ti ti-x" : "ti ti-plus"} />
          </button>
        )}

        {showAttachMenu && (
          <div
            className={styles.attachMenuPanel}
            onMouseLeave={() => setShowAttachMenu(false)}
          >
            <button onClick={() => imageInputRef.current?.click()}>
              <span
                className={styles.attachIconWrap}
                style={{ background: "#8e44ad" }}
              >
                <i className="ti ti-photo" />
              </span>
              Photo
            </button>
            <button onClick={() => docInputRef.current?.click()}>
              <span
                className={styles.attachIconWrap}
                style={{ background: "#2980b9" }}
              >
                <i className="ti ti-paperclip" />
              </span>
              Document
            </button>
            <button onClick={handleShareLocation}>
              <span
                className={styles.attachIconWrap}
                style={{ background: "#27ae60" }}
              >
                <i className="ti ti-map-pin" />
              </span>
              Location
            </button>
          </div>
        )}

        <button
          className={styles.iconBtn}
          onClick={() => setShowEmoji((v) => !v)}
          title="Emoji"
        >
          <i className="ti ti-mood-smile" />
        </button>

        {showEmoji && (
          <EmojiPicker
            onPick={(emoji) => {
              setText((t) => t + emoji);
              setShowEmoji(false);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmoji(false)}
          />
        )}

        {!isEditing && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept={MAX_ATTACHMENT_HINT.IMAGE}
              hidden
              onChange={(e) => handleFilePicked(e.target.files[0], "IMAGE")}
            />
            <input
              ref={docInputRef}
              type="file"
              accept={MAX_ATTACHMENT_HINT.DOCUMENT}
              hidden
              onChange={(e) => handleFilePicked(e.target.files[0], "DOCUMENT")}
            />
          </>
        )}

        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={isEditing ? "Edit message" : "Type a message"}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={onStopTyping}
          />
          {mentionCandidates.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionCandidates.map((m) => (
                <button key={m.identityId} onClick={() => insertMention(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {text.trim() ? (
          <button
            className={styles.sendBtn}
            onClick={submitText}
            disabled={uploading}
          >
            <i className="ti ti-send" />
          </button>
        ) : isEditing ? (
          <button className={styles.sendBtn} disabled>
            <i className="ti ti-send" />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={() => setRecording(true)}
            title="Record voice message"
          >
            <i className="ti ti-microphone" />
          </button>
        )}
      </div>
    </div>
  );
}
