import { useCallback, useMemo, useRef, useState } from "react";
import EmojiPicker from "./EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import useClickOutside from "../../hooks/useClickOutside";
import { uploadAttachment } from "../../api/messagingApi";
import { compressImageIfNeeded } from "../../utils/imageCompress";
import { formatFileSize } from "../../utils/messagingFormat";
import styles from "./MessageComposer.module.css";

const MAX_ATTACHMENT_HINT = {
  IMAGE: "image/*",
  DOCUMENT: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip",
};

// Mirrors MsgAttachmentServiceImpl's server-side limits exactly — checked
// here BEFORE spending any time/data on an upload attempt that the
// server would reject anyway. Failing fast and locally, especially on a
// slow mobile connection, is a meaningfully better experience than
// "upload for 30 seconds, then fail."
const MAX_UPLOAD_BYTES = {
  IMAGE: 15 * 1024 * 1024,
  DOCUMENT: 25 * 1024 * 1024,
  VOICE: 20 * 1024 * 1024,
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
  // Tracks "has the person tapped into the message field", independent of
  // whether they've typed anything yet — the mic->send icon swap fires on
  // this, not just on non-empty text (see the send/mic button render
  // below), per the explicit request that focusing the composer alone
  // should switch it.
  const [composerFocused, setComposerFocused] = useState(false);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  // Each popup gets its OWN ref covering its trigger button + panel
  // together (attachGroupRef, emojiGroupRef), so tapping the trigger
  // isn't misread as an "outside" click that would close-then-reopen it.
  // mentionGroupRef additionally covers the textarea itself — the mention
  // dropdown's whole purpose is to react to what's typed there, so
  // clicking/continuing to type in the textarea must NOT count as
  // "outside" the way it correctly does for the other two popups.
  const attachGroupRef = useRef(null);
  const emojiGroupRef = useRef(null);
  const mentionGroupRef = useRef(null);

  const isEditing = Boolean(editingMessage);
  const showSendIcon = isEditing || composerFocused || text.trim().length > 0;

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !groupMembers) return [];
    const q = mentionQuery.toLowerCase();
    return groupMembers
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, groupMembers]);

  useClickOutside(
    attachGroupRef,
    () => setShowAttachMenu(false),
    showAttachMenu,
  );
  useClickOutside(emojiGroupRef, () => setShowEmoji(false), showEmoji);
  useClickOutside(
    mentionGroupRef,
    useCallback(() => setMentionQuery(null), []),
    mentionCandidates.length > 0,
  );

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

  // Enter key is intentionally NOT wired to send anymore — it does
  // whatever a plain <textarea> already does with Enter/Shift+Enter by
  // default (insert a newline), matching the explicit requirement that
  // Enter should only ever create a new line. Sending happens exclusively
  // via the send icon button below (submitText).

  const handleFilePicked = async (file, kind) => {
    if (!file) return;
    setShowAttachMenu(false);
    setUploadError(null);

    // Images get downscaled/re-encoded client-side FIRST (see
    // imageCompress.js) — both so the size check right after this
    // reflects what will actually be uploaded, and because a full-
    // resolution phone-camera photo has no reason to travel over
    // someone's mobile data untouched when nothing in a chat bubble
    // displays it above a few hundred pixels wide anyway.
    const uploadFile =
      kind === "IMAGE" ? await compressImageIfNeeded(file) : file;

    if (uploadFile.size > MAX_UPLOAD_BYTES[kind]) {
      setUploadError(
        `That ${kind === "IMAGE" ? "image" : "file"} is ${formatFileSize(uploadFile.size)} — the limit is ${formatFileSize(MAX_UPLOAD_BYTES[kind])}.`,
      );
      return;
    }

    setUploading(true);
    try {
      const { data } = await uploadAttachment(uploadFile, kind);
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
    if (file.size > MAX_UPLOAD_BYTES.VOICE) {
      setUploadError(
        `That recording is ${formatFileSize(file.size)} — the limit is ${formatFileSize(MAX_UPLOAD_BYTES.VOICE)}.`,
      );
      return;
    }
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
          <div className={styles.attachGroup} ref={attachGroupRef}>
            <button
              className={`${styles.iconBtn} ${showAttachMenu ? styles.iconBtnActive : ""}`}
              onClick={() => setShowAttachMenu((v) => !v)}
              title="Attach"
              disabled={uploading}
            >
              <i className={showAttachMenu ? "ti ti-x" : "ti ti-plus"} />
            </button>

            {showAttachMenu && (
              <div className={styles.attachMenuPanel}>
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
          </div>
        )}

        <div className={styles.emojiGroup} ref={emojiGroupRef}>
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
            />
          )}
        </div>

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

        <div className={styles.textareaWrap} ref={mentionGroupRef}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={isEditing ? "Edit message" : "Type a message"}
            rows={1}
            value={text}
            onChange={handleChange}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => {
              setComposerFocused(false);
              onStopTyping();
            }}
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

        {showSendIcon ? (
          <button
            className={styles.sendBtn}
            onClick={submitText}
            disabled={uploading || !text.trim()}
          >
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
