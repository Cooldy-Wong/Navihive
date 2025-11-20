import { useState, useEffect, useMemo } from 'react';
import { NavigationClient } from './API/client';
import { MockNavigationClient } from './API/mock';
import { Site, Group } from './API/http';
import { GroupWithSites } from './types';
import ThemeToggle from './components/ThemeToggle';
import GroupCard from './components/GroupCard';
import LoginForm from './components/LoginForm';
import './App.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableGroupItem from './components/SortableGroupItem';
// Material UI 匯入
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  createTheme,
  ThemeProvider,
  CssBaseline,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Snackbar,
  InputAdornment,
  Slider,
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import GitHubIcon from '@mui/icons-material/GitHub';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

// 根據環境選擇使用真實API還是模擬API
const isDevEnvironment = import.meta.env.DEV;
const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';

const api =
  isDevEnvironment && !useRealApi
    ? new MockNavigationClient()
    : new NavigationClient(isDevEnvironment ? 'http://localhost:8788/api' : '/api');

// 排序模式列舉
enum SortMode {
  None, // 不排序
  GroupSort, // 分組排序
  SiteSort, // 站點排序
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
  } catch {
    // 嘗試備用方法
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im);
    return match && match[1] ? match[1] : url;
  }
}

// 預設配置
const DEFAULT_CONFIGS = {
  'site.title': '導航站',
  'site.name': '導航站',
  'site.customCss': '',
  'site.backgroundImage': '', // 背景圖片URL
  'site.backgroundOpacity': '0.15', // 背景蒙版透明度
  'site.iconApi': 'https://www.faviconextractor.com/favicon/{domain}?larger=true', // 預設使用的API介面，帶上 ?larger=true 參數可以獲取最大尺寸的圖示
};

function App() {
  // 主題模式狀態
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 建立Material UI主題
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode]
  );

  // 切換主題的回撥函式
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
  };

  const [groups, setGroups] = useState<GroupWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(SortMode.None);
  const [currentSortingGroupId, setCurrentSortingGroupId] = useState<number | null>(null);

  // 新增認證狀態
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // 配置狀態
  const [configs, setConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);
  const [openConfig, setOpenConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);

  // 配置感測器，支援滑鼠、觸控和鍵盤操作
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // 降低啟用閾值，使拖拽更敏感
        delay: 0, // 移除延遲
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100, // 降低觸控延遲
        tolerance: 3, // 降低容忍值
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 新增狀態管理
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [openAddSite, setOpenAddSite] = useState(false);
  const [newGroup, setNewGroup] = useState<Partial<Group>>({ name: '', order_num: 0 });
  const [newSite, setNewSite] = useState<Partial<Site>>({
    name: '',
    url: '',
    icon: '',
    description: '',
    notes: '',
    order_num: 0,
    group_id: 0,
  });

  // 新增菜單狀態
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(menuAnchorEl);

  // 新增匯入對話方塊狀態
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // 錯誤提示框狀態
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // 匯入結果提示框狀態
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');

  // 菜單打開關閉
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // 檢查認證狀態
  const checkAuthStatus = async () => {
    try {
      setIsAuthChecking(true);
      console.log('開始檢查認證狀態...');

      // 嘗試進行API呼叫，檢查是否需要認證
      const result = await api.checkAuthStatus();
      console.log('認證檢查結果:', result);

      if (!result) {
        // 未認證，需要登錄
        console.log('未認證，設定需要登錄狀態');

        // 如果有token但無效，清除它
        if (api.isLoggedIn()) {
          console.log('清除無效token');
          api.logout();
        }

        // 直接更新狀態，確保先設定認證狀態再結束檢查
        setIsAuthenticated(false);
        setIsAuthRequired(true);
      } else {
        // 直接更新認證狀態
        setIsAuthenticated(true);
        setIsAuthRequired(false);

        // 如果已經登錄或不需要認證，繼續載入數據
        console.log('已認證，開始載入數據');
        await fetchData();
        await fetchConfigs();
      }
    } catch (error) {
      console.error('認證檢查失敗:', error);
      // 如果返回401，說明需要認證
      if (error instanceof Error && error.message.includes('認證')) {
        console.log('檢測到認證錯誤，設定需要登錄狀態');
        setIsAuthenticated(false);
        setIsAuthRequired(true);
      }
    } finally {
      console.log('認證檢查完成');
      setIsAuthChecking(false);
    }
  };

  // 登錄功能
  const handleLogin = async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoginLoading(true);
      setLoginError(null);

      // 呼叫登錄介面
      const success = await api.login(username, password, rememberMe);

      if (success) {
        // 登錄成功
        setIsAuthenticated(true);
        setIsAuthRequired(false);
        // 載入數據
        await fetchData();
        await fetchConfigs();
      } else {
        // 登錄失敗
        handleError('使用者名稱或密碼錯誤');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('登錄失敗:', error);
      handleError('登錄失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
      setIsAuthenticated(false);
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出功能
  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setIsAuthRequired(true);

    // 清空數據
    setGroups([]);
    handleMenuClose();

    // 顯示提示資訊
    setError('已退出登錄，請重新登錄');
  };

  // 載入配置
  const fetchConfigs = async () => {
    try {
      const configsData = await api.getConfigs();
      setConfigs({
        ...DEFAULT_CONFIGS,
        ...configsData,
      });
      setTempConfigs({
        ...DEFAULT_CONFIGS,
        ...configsData,
      });
    } catch (error) {
      console.error('載入配置失敗:', error);
      // 使用預設配置
    }
  };

  useEffect(() => {
    // 檢查認證狀態
    checkAuthStatus();

    // 確保初始化時重置排序狀態
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  }, []);

  // 設定文件標題
  useEffect(() => {
    document.title = configs['site.title'] || '導航站';
  }, [configs]);

  // 應用自定義CSS
  useEffect(() => {
    const customCss = configs['site.customCss'];
    let styleElement = document.getElementById('custom-style');

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style';
      document.head.appendChild(styleElement);
    }

    // 新增安全過濾，防止CSS注入攻擊
    const sanitizedCss = sanitizeCSS(customCss || '');
    styleElement.textContent = sanitizedCss;
  }, [configs]);

  // CSS安全過濾函式
  const sanitizeCSS = (css: string): string => {
    if (!css) return '';

    // 移除可能導致XSS的內容
    return (
      css
        // 移除包含javascript:的URL
        .replace(/url\s*\(\s*(['"]?)javascript:/gi, 'url($1invalid:')
        // 移除expression
        .replace(/expression\s*\(/gi, 'invalid(')
        // 移除import
        .replace(/@import/gi, '/* @import */')
        // 移除behavior
        .replace(/behavior\s*:/gi, '/* behavior: */')
        // 過濾content屬性中的不安全內容
        .replace(/content\s*:\s*(['"]?).*?url\s*\(\s*(['"]?)javascript:/gi, 'content: $1')
    );
  };

  // 同步HTML的class以保持與現有CSS相容
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 處理錯誤的函式
  const handleError = (errorMessage: string) => {
    setSnackbarMessage(errorMessage);
    setSnackbarOpen(true);
    console.error(errorMessage);
  };

  // 關閉錯誤提示框
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const groupsData = await api.getGroups();

      // 獲取每個分組的站點並確保id存在
      const groupsWithSites = await Promise.all(
        groupsData
          .filter((group) => group.id !== undefined) // 過濾掉沒有id的分組
          .map(async (group) => {
            const sites = await api.getSites(group.id);
            return {
              ...group,
              id: group.id as number, // 確保id不為undefined
              sites,
            } as GroupWithSites;
          })
      );

      setGroups(groupsWithSites);
    } catch (error) {
      console.error('載入數據失敗:', error);
      handleError('載入數據失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));

      // 如果因為認證問題導致載入失敗，處理認證狀態
      if (error instanceof Error && error.message.includes('認證')) {
        setIsAuthRequired(true);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 更新站點
  const handleSiteUpdate = async (updatedSite: Site) => {
    try {
      if (updatedSite.id) {
        await api.updateSite(updatedSite.id, updatedSite);
        await fetchData(); // 重新載入數據
      }
    } catch (error) {
      console.error('更新站點失敗:', error);
      handleError('更新站點失敗: ' + (error as Error).message);
    }
  };

  // 刪除站點
  const handleSiteDelete = async (siteId: number) => {
    try {
      await api.deleteSite(siteId);
      await fetchData(); // 重新載入數據
    } catch (error) {
      console.error('刪除站點失敗:', error);
      handleError('刪除站點失敗: ' + (error as Error).message);
    }
  };

  // 儲存分組排序
  const handleSaveGroupOrder = async () => {
    try {
      console.log('儲存分組順序', groups);
      // 構造需要更新的分組順序數據
      const groupOrders = groups.map((group, index) => ({
        id: group.id as number, // 斷言id為number型別
        order_num: index,
      }));

      // 呼叫API更新分組順序
      const result = await api.updateGroupOrder(groupOrders);

      if (result) {
        console.log('分組排序更新成功');
        // 重新獲取最新數據
        await fetchData();
      } else {
        throw new Error('分組排序更新失敗');
      }

      setSortMode(SortMode.None);
      setCurrentSortingGroupId(null);
    } catch (error) {
      console.error('更新分組排序失敗:', error);
      handleError('更新分組排序失敗: ' + (error as Error).message);
    }
  };

  // 儲存站點排序
  const handleSaveSiteOrder = async (groupId: number, sites: Site[]) => {
    try {
      console.log('儲存站點排序', groupId, sites);

      // 構造需要更新的站點順序數據
      const siteOrders = sites.map((site, index) => ({
        id: site.id as number,
        order_num: index,
      }));

      // 呼叫API更新站點順序
      const result = await api.updateSiteOrder(siteOrders);

      if (result) {
        console.log('站點排序更新成功');
        // 重新獲取最新數據
        await fetchData();
      } else {
        throw new Error('站點排序更新失敗');
      }

      setSortMode(SortMode.None);
      setCurrentSortingGroupId(null);
    } catch (error) {
      console.error('更新站點排序失敗:', error);
      handleError('更新站點排序失敗: ' + (error as Error).message);
    }
  };

  // 啟動分組排序
  const startGroupSort = () => {
    console.log('開始分組排序');
    setSortMode(SortMode.GroupSort);
    setCurrentSortingGroupId(null);
  };

  // 啟動站點排序
  const startSiteSort = (groupId: number) => {
    console.log('開始站點排序');
    setSortMode(SortMode.SiteSort);
    setCurrentSortingGroupId(groupId);
  };

  // 取消排序
  const cancelSort = () => {
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  };

  // 處理拖拽結束事件
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = groups.findIndex((group) => group.id.toString() === active.id);
      const newIndex = groups.findIndex((group) => group.id.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setGroups(arrayMove(groups, oldIndex, newIndex));
      }
    }
  };

  // 新增分組相關函式
  const handleOpenAddGroup = () => {
    setNewGroup({ name: '', order_num: groups.length });
    setOpenAddGroup(true);
  };

  const handleCloseAddGroup = () => {
    setOpenAddGroup(false);
  };

  const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroup({
      ...newGroup,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateGroup = async () => {
    try {
      if (!newGroup.name) {
        handleError('分組名稱不能為空');
        return;
      }

      await api.createGroup(newGroup as Group);
      await fetchData(); // 重新載入數據
      handleCloseAddGroup();
      setNewGroup({ name: '', order_num: 0 }); // 重置表單
    } catch (error) {
      console.error('建立分組失敗:', error);
      handleError('建立分組失敗: ' + (error as Error).message);
    }
  };

  // 新增站點相關函式
  const handleOpenAddSite = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const maxOrderNum = group?.sites.length
      ? Math.max(...group.sites.map((s) => s.order_num)) + 1
      : 0;

    setNewSite({
      name: '',
      url: '',
      icon: '',
      description: '',
      notes: '',
      group_id: groupId,
      order_num: maxOrderNum,
    });

    setOpenAddSite(true);
  };

  const handleCloseAddSite = () => {
    setOpenAddSite(false);
  };

  const handleSiteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSite({
      ...newSite,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateSite = async () => {
    try {
      if (!newSite.name || !newSite.url) {
        handleError('站點名稱和URL不能為空');
        return;
      }

      await api.createSite(newSite as Site);
      await fetchData(); // 重新載入數據
      handleCloseAddSite();
    } catch (error) {
      console.error('建立站點失敗:', error);
      handleError('建立站點失敗: ' + (error as Error).message);
    }
  };

  // 配置相關函式
  const handleOpenConfig = () => {
    setTempConfigs({ ...configs });
    setOpenConfig(true);
  };

  const handleCloseConfig = () => {
    setOpenConfig(false);
  };

  const handleConfigInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempConfigs({
      ...tempConfigs,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveConfig = async () => {
    try {
      // 儲存所有配置
      for (const [key, value] of Object.entries(tempConfigs)) {
        if (configs[key] !== value) {
          await api.setConfig(key, value);
        }
      }

      // 更新配置狀態
      setConfigs({ ...tempConfigs });
      handleCloseConfig();
    } catch (error) {
      console.error('儲存配置失敗:', error);
      handleError('儲存配置失敗: ' + (error as Error).message);
    }
  };

  // 處理導出數據
  const handleExportData = async () => {
    try {
      setLoading(true);

      // 提取所有站點數據為單獨的陣列
      const allSites: Site[] = [];
      groups.forEach((group) => {
        if (group.sites && group.sites.length > 0) {
          allSites.push(...group.sites);
        }
      });

      const exportData = {
        // 只導出分組基本資訊，不包含站點
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          order_num: group.order_num,
        })),
        // 站點數據作為單獨的頂級陣列
        sites: allSites,
        configs: configs,
        // 新增版本和導出日期
        version: '1.0',
        exportDate: new Date().toISOString(),
      };

      // 建立並下載JSON檔案
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileName = `導航站備份_${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
    } catch (error) {
      console.error('導出數據失敗:', error);
      handleError('導出數據失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 處理匯入對話方塊
  const handleOpenImport = () => {
    setImportFile(null);
    setImportError(null);
    setOpenImport(true);
    handleMenuClose();
  };

  const handleCloseImport = () => {
    setOpenImport(false);
  };

  // 處理檔案選擇
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError(null);
    }
  };

  // 處理匯入數據
  const handleImportData = async () => {
    if (!importFile) {
      handleError('請選擇要匯入的檔案');
      return;
    }

    try {
      setImportLoading(true);
      setImportError(null);

      const fileReader = new FileReader();
      fileReader.readAsText(importFile, 'UTF-8');

      fileReader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('讀取檔案失敗');
          }

          const importData = JSON.parse(e.target.result as string);

          // 驗證匯入數據格式
          if (!importData.groups || !Array.isArray(importData.groups)) {
            throw new Error('匯入檔案格式錯誤：缺少分組數據');
          }

          if (!importData.sites || !Array.isArray(importData.sites)) {
            throw new Error('匯入檔案格式錯誤：缺少站點數據');
          }

          if (!importData.configs || typeof importData.configs !== 'object') {
            throw new Error('匯入檔案格式錯誤：缺少配置數據');
          }

          // 呼叫API匯入數據
          const result = await api.importData(importData);

          if (!result.success) {
            throw new Error(result.error || '匯入失敗');
          }

          // 顯示匯入結果統計
          const stats = result.stats;
          if (stats) {
            const summary = [
              `匯入成功！`,
              `分組：發現${stats.groups.total}個，新建${stats.groups.created}個，合併${stats.groups.merged}個`,
              `卡片：發現${stats.sites.total}個，新建${stats.sites.created}個，更新${stats.sites.updated}個，跳過${stats.sites.skipped}個`,
            ].join('\n');

            setImportResultMessage(summary);
            setImportResultOpen(true);
          }

          // 重新整理數據
          await fetchData();
          await fetchConfigs();
          handleCloseImport();
        } catch (error) {
          console.error('解析匯入數據失敗:', error);
          handleError('解析匯入數據失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        } finally {
          setImportLoading(false);
        }
      };

      fileReader.onerror = () => {
        handleError('讀取檔案失敗');
        setImportLoading(false);
      };
    } catch (error) {
      console.error('匯入數據失敗:', error);
      handleError('匯入數據失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setImportLoading(false);
    }
  };

  // 渲染登錄頁面
  const renderLoginForm = () => {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <LoginForm onLogin={handleLogin} loading={loginLoading} error={loginError} />
      </Box>
    );
  };

  // 如果正在檢查認證狀態，顯示載入界面
  if (isAuthChecking) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
          }}
        >
          <CircularProgress size={60} thickness={4} />
        </Box>
      </ThemeProvider>
    );
  }

  // 如果需要認證但未認證，顯示登錄界面
  if (isAuthRequired && !isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {renderLoginForm()}
      </ThemeProvider>
    );
  }

  // 更新分組
  const handleGroupUpdate = async (updatedGroup: Group) => {
    try {
      if (updatedGroup.id) {
        await api.updateGroup(updatedGroup.id, updatedGroup);
        await fetchData(); // 重新載入數據
      }
    } catch (error) {
      console.error('更新分組失敗:', error);
      handleError('更新分組失敗: ' + (error as Error).message);
    }
  };

  // 刪除分組
  const handleGroupDelete = async (groupId: number) => {
    try {
      await api.deleteGroup(groupId);
      await fetchData(); // 重新載入數據
    } catch (error) {
      console.error('刪除分組失敗:', error);
      handleError('刪除分組失敗: ' + (error as Error).message);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* 錯誤提示 Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity='error'
          variant='filled'
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* 匯入結果提示 Snackbar */}
      <Snackbar
        open={importResultOpen}
        autoHideDuration={6000}
        onClose={() => setImportResultOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setImportResultOpen(false)}
          severity='success'
          variant='filled'
          sx={{
            width: '100%',
            whiteSpace: 'pre-line',
            backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2e7d32' : undefined),
            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
            '& .MuiAlert-icon': {
              color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
            },
          }}
        >
          {importResultMessage}
        </Alert>
      </Snackbar>

      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          transition: 'all 0.3s ease-in-out',
          position: 'relative', // 新增相對定位，作為背景圖片的容器
          overflow: 'hidden', // 防止背景圖片溢出
        }}
      >
        {/* 背景圖片 */}
        {configs['site.backgroundImage'] && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${configs['site.backgroundImage']})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                zIndex: 0,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')'
                      : 'rgba(255, 255, 255, ' +
                        (1 - Number(configs['site.backgroundOpacity'])) +
                        ')',
                  zIndex: 1,
                },
              }}
            />
          </>
        )}

        <Container
          maxWidth='lg'
          sx={{
            py: 4,
            px: { xs: 2, sm: 3, md: 4 },
            position: 'relative', // 使內容位於背景圖片和蒙版之上
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 5,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 },
            }}
          >
            <Typography
              variant='h3'
              component='h1'
              fontWeight='bold'
              color='text.primary'
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.125rem', md: '3rem' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              {configs['site.name']}
            </Typography>
            <Stack
              direction={{ xs: 'row', sm: 'row' }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems='center'
              width={{ xs: '100%', sm: 'auto' }}
              justifyContent={{ xs: 'center', sm: 'flex-end' }}
              flexWrap='wrap'
              sx={{ gap: { xs: 1, sm: 2 }, py: { xs: 1, sm: 0 } }}
            >
              {sortMode !== SortMode.None ? (
                <>
                  {sortMode === SortMode.GroupSort && (
                    <Button
                      variant='contained'
                      color='primary'
                      startIcon={<SaveIcon />}
                      onClick={handleSaveGroupOrder}
                      size='small'
                      sx={{
                        minWidth: 'auto',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    >
                      儲存分組順序
                    </Button>
                  )}
                  <Button
                    variant='outlined'
                    color='inherit'
                    startIcon={<CancelIcon />}
                    onClick={cancelSort}
                    size='small'
                    sx={{
                      minWidth: 'auto',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    取消編輯
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant='contained'
                    color='primary'
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddGroup}
                    size='small'
                    sx={{
                      minWidth: 'auto',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    新增分組
                  </Button>

                  <Button
                    variant='outlined'
                    color='primary'
                    startIcon={<MenuIcon />}
                    onClick={handleMenuOpen}
                    aria-controls={openMenu ? 'navigation-menu' : undefined}
                    aria-haspopup='true'
                    aria-expanded={openMenu ? 'true' : undefined}
                    size='small'
                    sx={{
                      minWidth: 'auto',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    更多選項
                  </Button>
                  <Menu
                    id='navigation-menu'
                    anchorEl={menuAnchorEl}
                    open={openMenu}
                    onClose={handleMenuClose}
                    MenuListProps={{
                      'aria-labelledby': 'navigation-button',
                    }}
                  >
                    <MenuItem onClick={startGroupSort}>
                      <ListItemIcon>
                        <SortIcon fontSize='small' />
                      </ListItemIcon>
                      <ListItemText>編輯排序</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleOpenConfig}>
                      <ListItemIcon>
                        <SettingsIcon fontSize='small' />
                      </ListItemIcon>
                      <ListItemText>網站設定</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleExportData}>
                      <ListItemIcon>
                        <FileDownloadIcon fontSize='small' />
                      </ListItemIcon>
                      <ListItemText>導出數據</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleOpenImport}>
                      <ListItemIcon>
                        <FileUploadIcon fontSize='small' />
                      </ListItemIcon>
                      <ListItemText>匯入數據</ListItemText>
                    </MenuItem>
                    {isAuthenticated && (
                      <>
                        <Divider />
                        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                          <ListItemIcon sx={{ color: 'error.main' }}>
                            <LogoutIcon fontSize='small' />
                          </ListItemIcon>
                          <ListItemText>退出登錄</ListItemText>
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </>
              )}
              <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
            </Stack>
          </Box>

          {loading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
              }}
            >
              <CircularProgress size={60} thickness={4} />
            </Box>
          )}

          {!loading && !error && (
            <Box
              sx={{
                '& > *': { mb: 5 },
                minHeight: '100px',
              }}
            >
              {sortMode === SortMode.GroupSort ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={groups.map((group) => group.id.toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack
                      spacing={2}
                      sx={{
                        '& > *': {
                          transition: 'none',
                        },
                      }}
                    >
                      {groups.map((group) => (
                        <SortableGroupItem key={group.id} id={group.id.toString()} group={group} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              ) : (
                <Stack spacing={5}>
                  {groups.map((group) => (
                    <GroupCard
                      key={`group-${group.id}`}
                      group={group}
                      sortMode={sortMode === SortMode.None ? 'None' : 'SiteSort'}
                      currentSortingGroupId={currentSortingGroupId}
                      onUpdate={handleSiteUpdate}
                      onDelete={handleSiteDelete}
                      onSaveSiteOrder={handleSaveSiteOrder}
                      onStartSiteSort={startSiteSort}
                      onAddSite={handleOpenAddSite}
                      onUpdateGroup={handleGroupUpdate}
                      onDeleteGroup={handleGroupDelete}
                      configs={configs}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {/* 新增分組對話方塊 */}
          <Dialog
            open={openAddGroup}
            onClose={handleCloseAddGroup}
            maxWidth='md'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 3, md: 4 },
                width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' },
                maxWidth: { sm: '600px' },
              },
            }}
          >
            <DialogTitle>
              新增分組
              <IconButton
                aria-label='close'
                onClick={handleCloseAddGroup}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>請輸入新分組的資訊</DialogContentText>
              <TextField
                autoFocus
                margin='dense'
                id='group-name'
                name='name'
                label='分組名稱'
                type='text'
                fullWidth
                variant='outlined'
                value={newGroup.name}
                onChange={handleGroupInputChange}
                sx={{ mb: 2 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseAddGroup} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleCreateGroup} variant='contained' color='primary'>
                建立
              </Button>
            </DialogActions>
          </Dialog>

          {/* 新增站點對話方塊 */}
          <Dialog
            open={openAddSite}
            onClose={handleCloseAddSite}
            maxWidth='md'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 'auto' },
                width: { xs: 'calc(100% - 32px)', sm: 'auto' },
              },
            }}
          >
            <DialogTitle>
              新增站點
              <IconButton
                aria-label='close'
                onClick={handleCloseAddSite}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>請輸入新站點的資訊</DialogContentText>
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      autoFocus
                      margin='dense'
                      id='site-name'
                      name='name'
                      label='站點名稱'
                      type='text'
                      fullWidth
                      variant='outlined'
                      value={newSite.name}
                      onChange={handleSiteInputChange}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      margin='dense'
                      id='site-url'
                      name='url'
                      label='站點URL'
                      type='url'
                      fullWidth
                      variant='outlined'
                      value={newSite.url}
                      onChange={handleSiteInputChange}
                    />
                  </Box>
                </Box>
                <TextField
                  margin='dense'
                  id='site-icon'
                  name='icon'
                  label='圖示URL'
                  type='url'
                  fullWidth
                  variant='outlined'
                  value={newSite.icon}
                  onChange={handleSiteInputChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => {
                            if (!newSite.url) {
                              handleError('請先輸入站點URL');
                              return;
                            }
                            const domain = extractDomain(newSite.url);
                            if (domain) {
                              const actualIconApi =
                                configs['site.iconApi'] ||
                                'https://www.faviconextractor.com/favicon/{domain}?larger=true';
                              const iconUrl = actualIconApi.replace('{domain}', domain);
                              setNewSite({
                                ...newSite,
                                icon: iconUrl,
                              });
                            } else {
                              handleError('無法從URL中獲取域名');
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
                <TextField
                  margin='dense'
                  id='site-description'
                  name='description'
                  label='站點描述'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={newSite.description}
                  onChange={handleSiteInputChange}
                />
                <TextField
                  margin='dense'
                  id='site-notes'
                  name='notes'
                  label='備註'
                  type='text'
                  fullWidth
                  multiline
                  rows={2}
                  variant='outlined'
                  value={newSite.notes}
                  onChange={handleSiteInputChange}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseAddSite} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleCreateSite} variant='contained' color='primary'>
                建立
              </Button>
            </DialogActions>
          </Dialog>

          {/* 網站配置對話方塊 */}
          <Dialog
            open={openConfig}
            onClose={handleCloseConfig}
            maxWidth='sm'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 3, md: 4 },
                width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' },
                maxWidth: { sm: '600px' },
              },
            }}
          >
            <DialogTitle>
              網站設定
              <IconButton
                aria-label='close'
                onClick={handleCloseConfig}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>配置網站的基本資訊和外觀</DialogContentText>
              <Stack spacing={2}>
                <TextField
                  margin='dense'
                  id='site-title'
                  name='site.title'
                  label='網站標題 (瀏覽器標籤)'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={tempConfigs['site.title']}
                  onChange={handleConfigInputChange}
                />
                <TextField
                  margin='dense'
                  id='site-name'
                  name='site.name'
                  label='網站名稱 (顯示在頁面中)'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={tempConfigs['site.name']}
                  onChange={handleConfigInputChange}
                />
                {/* 獲取圖示API設定項 */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant='subtitle1' gutterBottom>
                    獲取圖示API設定
                  </Typography>
                  <TextField
                    margin='dense'
                    id='site-icon-api'
                    name='site.iconApi'
                    label='獲取圖示API URL'
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={tempConfigs['site.iconApi']}
                    onChange={handleConfigInputChange}
                    placeholder='https://example.com/favicon/{domain}'
                    helperText='輸入獲取圖示API的地址，使用 {domain} 作為域名佔位符'
                  />
                </Box>
                {/* 新增背景圖片設定 */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant='subtitle1' gutterBottom>
                    背景圖片設定
                  </Typography>
                  <TextField
                    margin='dense'
                    id='site-background-image'
                    name='site.backgroundImage'
                    label='背景圖片URL'
                    type='url'
                    fullWidth
                    variant='outlined'
                    value={tempConfigs['site.backgroundImage']}
                    onChange={handleConfigInputChange}
                    placeholder='https://example.com/background.jpg'
                    helperText='輸入圖片URL，留空則不使用背景圖片'
                  />

                  <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      id='background-opacity-slider'
                      gutterBottom
                    >
                      背景蒙版透明度: {Number(tempConfigs['site.backgroundOpacity']).toFixed(2)}
                    </Typography>
                    <Slider
                      aria-labelledby='background-opacity-slider'
                      name='site.backgroundOpacity'
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay='auto'
                      value={Number(tempConfigs['site.backgroundOpacity'])}
                      onChange={(_, value) => {
                        setTempConfigs({
                          ...tempConfigs,
                          'site.backgroundOpacity': String(value),
                        });
                      }}
                    />
                    <Typography variant='caption' color='text.secondary'>
                      值越大，背景圖片越清晰，內容可能越難看清
                    </Typography>
                  </Box>
                </Box>
                <TextField
                  margin='dense'
                  id='site-custom-css'
                  name='site.customCss'
                  label='自定義CSS'
                  type='text'
                  fullWidth
                  multiline
                  rows={6}
                  variant='outlined'
                  value={tempConfigs['site.customCss']}
                  onChange={handleConfigInputChange}
                  placeholder='/* 自定義樣式 */\nbody { }'
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseConfig} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleSaveConfig} variant='contained' color='primary'>
                儲存設定
              </Button>
            </DialogActions>
          </Dialog>

          {/* 匯入數據對話方塊 */}
          <Dialog
            open={openImport}
            onClose={handleCloseImport}
            maxWidth='sm'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 'auto' },
                width: { xs: 'calc(100% - 32px)', sm: 'auto' },
              },
            }}
          >
            <DialogTitle>
              匯入數據
              <IconButton
                aria-label='close'
                onClick={handleCloseImport}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                請選擇要匯入的JSON檔案，匯入將覆蓋現有數據。
              </DialogContentText>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant='outlined'
                  component='label'
                  startIcon={<FileUploadIcon />}
                  sx={{ mb: 2 }}
                >
                  選擇檔案
                  <input type='file' hidden accept='.json' onChange={handleFileSelect} />
                </Button>
                {importFile && (
                  <Typography variant='body2' sx={{ mt: 1 }}>
                    已選擇: {importFile.name}
                  </Typography>
                )}
              </Box>
              {importError && (
                <Alert severity='error' sx={{ mb: 2 }}>
                  {importError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseImport} variant='outlined'>
                取消
              </Button>
              <Button
                onClick={handleImportData}
                variant='contained'
                color='primary'
                disabled={!importFile || importLoading}
                startIcon={importLoading ? <CircularProgress size={20} /> : <FileUploadIcon />}
              >
                {importLoading ? '匯入中...' : '匯入'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* GitHub角標 - 在移動端調整位置 */}
          <Box
            sx={{
              position: 'fixed',
              bottom: { xs: 8, sm: 16 },
              right: { xs: 8, sm: 16 },
              zIndex: 10,
            }}
          >
            <Paper
              component='a'
              href='https://github.com/zqq-nuli/Navihive'
              target='_blank'
              rel='noopener noreferrer'
              elevation={2}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1,
                borderRadius: 10,
                bgcolor: 'background.paper',
                color: 'text.secondary',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'text.primary',
                  boxShadow: 4,
                },
                textDecoration: 'none',
              }}
            >
              <GitHubIcon />
            </Paper>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
