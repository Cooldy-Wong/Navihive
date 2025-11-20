// src/components/SiteSettingsModal.tsx
import { useState } from 'react';
import { Site, Group } from '../API/http';
// Material UI 匯入
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Avatar,
  useTheme,
  SelectChangeEvent,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

interface SiteSettingsModalProps {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;
  onClose: () => void;
  groups?: Group[]; // 可選的分組列表
  iconApi?: string; // 圖示API配置
}

// 輔助函式：提取域名
function extractDomain(url: string): string | null {
  if (!url) return null;

  try {
    // 嘗試自動新增協議頭，如果缺少的話
    let fullUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      fullUrl = 'http://' + url;
    }
    const parsedUrl = new URL(fullUrl);
    return parsedUrl.hostname;
  } catch (e) {
    // 嘗試備用方法
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im);
    return match && match[1] ? match[1] : url;
  }
}

export default function SiteSettingsModal({
  site,
  onUpdate,
  onDelete,
  onClose,
  groups = [],
  iconApi = 'https://www.faviconextractor.com/favicon/{domain}?larger=true',
}: SiteSettingsModalProps) {
  const theme = useTheme();

  // 儲存字串形式的group_id，與Material-UI的Select相容
  const [formData, setFormData] = useState({
    name: site.name,
    url: site.url,
    icon: site.icon || '',
    description: site.description || '',
    notes: site.notes || '',
    group_id: String(site.group_id),
  });

  // 用於預覽圖示
  const [iconPreview, setIconPreview] = useState<string | null>(site.icon || null);

  // 處理表單欄位變化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 處理下拉選單變化
  const handleSelectChange = (e: SelectChangeEvent) => {
    setFormData((prev) => ({
      ...prev,
      group_id: e.target.value,
    }));
  };

  // 處理圖示上傳或URL輸入
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, icon: value }));

    // 檢查URL是否是有效的圖片URL
    const isValidImageUrl = (url: string): boolean => {
      // 檢查URL格式
      try {
        new URL(url);
        // 檢查是否是常見圖片格式
        return (
          /\.(jpeg|jpg|gif|png|svg|webp|ico)(\?.*)?$/i.test(url) ||
          /^https?:\/\/.*\/favicon\.(ico|png)(\?.*)?$/i.test(url) ||
          /^data:image\//i.test(url)
        );
      } catch {
        return false;
      }
    };

    // 僅當輸入看起來像有效的圖片URL時才設定預覽
    if (value && isValidImageUrl(value)) {
      setIconPreview(value);
    } else {
      setIconPreview(null);
    }
  };

  // 處理圖示載入錯誤
  const handleIconError = () => {
    setIconPreview(null);
  };

  // 提交表單
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 更新網站資訊，將group_id轉為數字
    onUpdate({
      ...site,
      ...formData,
      group_id: Number(formData.group_id),
    });

    onClose();
  };

  // 確認刪除
  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除這個網站嗎？此操作不可恢復。')) {
      onDelete(site.id!);
      onClose();
    }
  };

  // 計算首字母圖示
  const fallbackIcon = formData.name?.charAt(0).toUpperCase() || 'A';

  return (
    <Dialog
      open={true}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      PaperProps={{
        sx: {
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 2,
          pb: 1.5,
        }}
      >
        <Typography variant='h6' component='div' fontWeight='600'>
          網站設定
        </Typography>
        <IconButton edge='end' color='inherit' onClick={onClose} aria-label='關閉' size='small'>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            {/* 網站名稱 */}
            <TextField
              id='name'
              name='name'
              label='網站名稱'
              required
              fullWidth
              value={formData.name || ''}
              onChange={handleChange}
              placeholder='輸入網站名稱'
              variant='outlined'
              size='small'
            />

            {/* 網站鏈接 */}
            <TextField
              id='url'
              name='url'
              label='網站鏈接'
              required
              fullWidth
              value={formData.url || ''}
              onChange={handleChange}
              placeholder='https://example.com'
              variant='outlined'
              size='small'
              type='url'
            />

            {/* 網站圖示 */}
            <Box>
              <Typography variant='body2' color='text.secondary' gutterBottom>
                圖示 URL
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {iconPreview ? (
                  <Avatar
                    src={iconPreview}
                    alt={formData.name || 'Icon Preview'}
                    sx={{ width: 40, height: 40, borderRadius: 1.5 }}
                    imgProps={{
                      onError: handleIconError,
                      style: { objectFit: 'cover' },
                    }}
                    variant='rounded'
                  />
                ) : (
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: 'primary.light',
                      color: 'primary.main',
                      border: '1px solid',
                      borderColor: 'primary.main',
                    }}
                    variant='rounded'
                  >
                    {fallbackIcon}
                  </Avatar>
                )}

                <TextField
                  id='icon'
                  name='icon'
                  fullWidth
                  value={formData.icon || ''}
                  onChange={handleIconChange}
                  placeholder='https://example.com/icon.png'
                  variant='outlined'
                  size='small'
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => {
                            if (!formData.url) {
                              // handleError("請先輸入站點URL");
                              return;
                            }
                            const domain = extractDomain(formData.url);
                            if (domain) {
                              const actualIconApi =
                                iconApi ||
                                'https://www.faviconextractor.com/favicon/{domain}?larger=true';
                              const iconUrl = actualIconApi.replace('{domain}', domain);
                              setFormData((prev) => ({
                                ...prev,
                                icon: iconUrl,
                              }));
                              setIconPreview(iconUrl);
                            } else {
                              // handleError("無法從URL中獲取域名");
                            }
                          }}
                          edge='end'
                          title='自動獲取圖示'
                        >
                          <AutoFixHighIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>

            {/* 分組選擇 */}
            {groups.length > 0 && (
              <FormControl fullWidth size='small'>
                <InputLabel id='group-select-label'>所屬分組</InputLabel>
                <Select
                  labelId='group-select-label'
                  id='group_id'
                  name='group_id'
                  value={formData.group_id}
                  label='所屬分組'
                  onChange={handleSelectChange}
                >
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 網站描述 */}
            <TextField
              id='description'
              name='description'
              label='網站描述'
              multiline
              rows={2}
              fullWidth
              value={formData.description || ''}
              onChange={handleChange}
              placeholder='簡短的網站描述'
              variant='outlined'
              size='small'
            />

            {/* 備註 */}
            <TextField
              id='notes'
              name='notes'
              label='備註'
              multiline
              rows={3}
              fullWidth
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder='可選的私人備註'
              variant='outlined'
              size='small'
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'space-between' }}>
          <Button
            onClick={confirmDelete}
            color='error'
            variant='contained'
            startIcon={<DeleteIcon />}
          >
            刪除
          </Button>

          <Box>
            <Button
              onClick={onClose}
              color='inherit'
              variant='outlined'
              sx={{ mr: 1.5 }}
              startIcon={<CancelIcon />}
            >
              取消
            </Button>
            <Button type='submit' color='primary' variant='contained' startIcon={<SaveIcon />}>
              儲存
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
}
