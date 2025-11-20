import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Group } from '../API/http';

interface EditGroupDialogProps {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onSave: (group: Group) => void;
  onDelete: (groupId: number) => void;
}

const EditGroupDialog: React.FC<EditGroupDialogProps> = ({
  open,
  group,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 當彈窗打開時，初始化名稱
  React.useEffect(() => {
    if (group) {
      setName(group.name);
    }
    // 關閉刪除確認狀態
    setShowDeleteConfirm(false);
  }, [group, open]);

  const handleSave = () => {
    if (!group || !name.trim()) return;

    onSave({
      ...group,
      name: name.trim(),
    });
  };

  const handleDelete = () => {
    if (!group) return;

    if (!showDeleteConfirm) {
      // 顯示刪除確認
      setShowDeleteConfirm(true);
    } else {
      // 確認刪除
      onDelete(group.id!);
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>編輯分組</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <TextField
            label='分組名稱'
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant='outlined'
            autoFocus
          />
        </Box>

        {showDeleteConfirm && (
          <Alert severity='warning' sx={{ mt: 2 }}>
            <Typography variant='body2'>
              確定要刪除分組 "{group.name}" 嗎？
              <strong>刪除此分組將同時刪除該分組下的所有網站。</strong>
              此操作無法撤銷。
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {!showDeleteConfirm ? (
          <>
            <Button onClick={onClose} color='inherit'>
              取消
            </Button>
            <Button onClick={handleDelete} color='error' variant='outlined'>
              刪除
            </Button>
            <Button
              onClick={handleSave}
              color='primary'
              variant='contained'
              disabled={!name.trim()}
            >
              儲存
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setShowDeleteConfirm(false)} color='inherit'>
              取消
            </Button>
            <Button onClick={handleDelete} color='error' variant='contained'>
              確認刪除
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EditGroupDialog;
