import { Button, Group, Modal, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState, type FormEvent } from "react";
import { PASSWORD_MAX, PASSWORD_MIN } from "../../shared/password";
import { authClient } from "../auth";

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) {
      return setError(`New password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`);
    }
    if (next !== confirm) return setError("New passwords don't match");
    setBusy(true);
    setError(null);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (error) return setError(error.message ?? "Couldn't change the password");
    notifications.show({ color: "teal", message: "Password changed. Other devices were signed out." });
    reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      title={<Text fw={800}>Change password</Text>}
    >
      <form onSubmit={submit}>
        <Stack gap="md">
          <PasswordInput label="Current password" value={current} onChange={(e) => setCurrent(e.currentTarget.value)} required autoFocus />
          <PasswordInput label="New password" value={next} onChange={(e) => setNext(e.currentTarget.value)} required />
          <PasswordInput
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            required
            error={error}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={busy}>
              Change password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
