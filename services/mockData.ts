
import { User, AttendanceRecord, UserRole, AttendanceStatus, Camera, CameraType, CameraStatus } from '../types';
import { format, subMinutes } from 'date-fns';

export const mockUsers: User[] = [
  // Existing Users
  { id: 'U-1001', fullName: 'Sarvar Komilov', role: UserRole.ADMIN, department: 'Xavfsizlik', enrolledDate: '2023-01-15', hasEmbedding: true, lastActive: 'Hozir', avatarUrl: 'https://picsum.photos/id/64/200/200' },
  { id: 'U-1002', fullName: 'Jamshid Rasulov', role: UserRole.OPERATOR, department: 'HR (Kadrlar)', enrolledDate: '2023-02-20', hasEmbedding: true, lastActive: '2 soat oldin', avatarUrl: 'https://picsum.photos/id/65/200/200' },
  { id: 'U-1003', fullName: 'Hasan Fayziyev', role: UserRole.EMPLOYEE, department: 'IT Bo\'limi', enrolledDate: '2023-03-10', hasEmbedding: true, lastActive: '5 daq oldin', avatarUrl: 'https://picsum.photos/id/66/200/200' },
  { id: 'U-1004', fullName: 'Sevara Shamsiyeva', role: UserRole.EMPLOYEE, department: 'Operatsiyalar', enrolledDate: '2023-05-12', hasEmbedding: true, lastActive: '10 daq oldin', avatarUrl: 'https://picsum.photos/id/67/200/200' },
  { id: 'U-1005', fullName: 'Laziz Fozilov', role: UserRole.EMPLOYEE, department: 'Logistika', enrolledDate: '2023-06-01', hasEmbedding: false, lastActive: '1 kun oldin', avatarUrl: 'https://picsum.photos/id/68/200/200' },
  { id: 'U-1006', fullName: 'Admin Root', role: UserRole.ADMIN, department: 'IT Bo\'limi', enrolledDate: '2023-07-01', hasEmbedding: true, lastActive: '1 daq oldin', avatarUrl: 'https://picsum.photos/id/69/200/200' },
  
  // New High-Security Users for Face Detector v2.0
  { id: '8842-X-2024', fullName: 'Alex Rivera', role: UserRole.ADMIN, department: 'R&D Markazi', enrolledDate: '2023-01-15', hasEmbedding: true, lastActive: 'Hozir', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: 'U-1007', fullName: 'Sora Chen', role: UserRole.ADMIN, department: 'Xavfsizlik', enrolledDate: '2023-01-15', hasEmbedding: true, lastActive: 'Hozir', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: 'U-1008', fullName: 'Mark Tursunov', role: UserRole.OPERATOR, department: 'Operatsiyalar', enrolledDate: '2023-02-20', hasEmbedding: true, lastActive: '2 soat oldin', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
];

export const mockCameras: Camera[] = [
  { 
    id: 'CAM-01', 
    name: 'Asosiy Darvoza (Hikvision)', 
    location: 'Darvoza va Avtoturargoh', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.101:554/Streaming/Channels/101', 
    status: CameraStatus.ONLINE, 
    fps: 30, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 2.8,
    sensorWidth: 4.8,
    sensorHeight: 3.6
  },
  { 
    id: 'CAM-02', 
    name: 'Hovli Archa (Dahua)', 
    location: 'Hovli va Yashil Maydon', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.102:554/cam/realmonitor?channel=1&subtype=0', 
    status: CameraStatus.ONLINE, 
    fps: 25, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 3.6,
    sensorWidth: 4.8,
    sensorHeight: 3.6 
  },
  { 
    id: 'CAM-03', 
    name: 'Kirish Pillapoya (Uniview)', 
    location: 'Mehmonxona Eshigi', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.103:554/onvif1', 
    status: CameraStatus.ONLINE, 
    fps: 20, 
    resolution: '1280x720', 
    lastActive: 'Hozir',
    focalLength: 2.8,
    sensorWidth: 4.8,
    sensorHeight: 3.6
  },
  { 
    id: 'CAM-04', 
    name: 'Oshxona Ichki (Dahua)', 
    location: 'Bino Ichki - Oshxona', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.104:554/onvif2', 
    status: CameraStatus.ONLINE, 
    fps: 25, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 3.6,
    sensorWidth: 4.8,
    sensorHeight: 3.6 
  },
  { 
    id: 'CAM-05', 
    name: "Yo'lak Yo'nalishi (Hikvision)", 
    location: "Bino Ichki - Yo'lak", 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.105:554/onvif3', 
    status: CameraStatus.ONLINE, 
    fps: 30, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 2.8,
    sensorWidth: 4.8,
    sensorHeight: 3.6 
  },
  { 
    id: 'CAM-06', 
    name: 'Sharqiy Devor (Dahua)', 
    location: 'Tashqi Hudud - Sharq', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.106:554/onvif4', 
    status: CameraStatus.ONLINE, 
    fps: 24, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 4.0,
    sensorWidth: 4.8,
    sensorHeight: 3.6 
  },
  { 
    id: 'CAM-07', 
    name: 'Janubiy Devor (Uniview)', 
    location: 'Tashqi Hudud - Janub', 
    type: CameraType.RTSP, 
    streamUrl: 'rtsp://admin:admin12345@192.168.1.107:554/onvif5', 
    status: CameraStatus.ONLINE, 
    fps: 24, 
    resolution: '1920x1080', 
    lastActive: 'Hozir',
    focalLength: 4.0,
    sensorWidth: 4.8,
    sensorHeight: 3.6 
  }
];

const generateLogs = (): AttendanceRecord[] => {
  const logs: AttendanceRecord[] = [];
  const now = new Date();

  // Helper to find user
  const getUser = (id: string) => mockUsers.find(u => u.id === id);

  // New Live Logs for Demo
  logs.push({
    id: 'LOG-LIVE-01',
    userId: '8842-X-2024',
    userName: 'Alex Rivera',
    userAvatar: getUser('8842-X-2024')?.avatarUrl,
    department: 'R&D Markazi',
    timestamp: format(now, "HH:mm:ss"),
    checkIn: '08:00',
    checkOut: null,
    status: AttendanceStatus.PRESENT,
    confidenceScore: 0.99,
    livenessVerified: true,
    nodeId: 'CAM-01-KIRISH'
  });

  // Existing Mock Logs
  logs.push({
    id: 'LOG-5001',
    userId: 'U-1001',
    userName: 'Sarvar Komilov',
    userAvatar: getUser('U-1001')?.avatarUrl,
    department: 'Xavfsizlik',
    timestamp: format(subMinutes(now, 15), "HH:mm:ss"),
    checkIn: '08:45',
    checkOut: null,
    status: AttendanceStatus.PRESENT,
    confidenceScore: 0.98,
    livenessVerified: true,
    nodeId: 'CAM-01-KIRISH'
  });

  logs.push({
    id: 'LOG-5002',
    userId: 'U-1003',
    userName: 'Hasan Fayziyev',
    userAvatar: getUser('U-1003')?.avatarUrl,
    department: 'IT Bo\'limi',
    timestamp: format(subMinutes(now, 45), "HH:mm:ss"),
    checkIn: '09:15',
    checkOut: null,
    status: AttendanceStatus.LATE,
    confidenceScore: 0.94,
    livenessVerified: true,
    nodeId: 'CAM-01-KIRISH'
  });

  logs.push({
    id: 'LOG-5003',
    userId: 'U-1004',
    userName: 'Sevara Shamsiyeva',
    userAvatar: getUser('U-1004')?.avatarUrl,
    department: 'Operatsiyalar',
    timestamp: format(subMinutes(now, 120), "HH:mm:ss"),
    checkIn: '08:55',
    checkOut: '17:00',
    status: AttendanceStatus.PRESENT,
    confidenceScore: 0.99,
    livenessVerified: true,
    nodeId: 'CAM-02-KORIDOR'
  });

  logs.push({
    id: 'LOG-5004',
    userId: 'UNKNOWN',
    userName: 'Noma\'lum Shaxs',
    department: 'N/A',
    timestamp: format(subMinutes(now, 10), "HH:mm:ss"),
    checkIn: '-',
    checkOut: null,
    status: AttendanceStatus.ABSENT,
    confidenceScore: 0.45,
    livenessVerified: false,
    nodeId: 'CAM-01-KIRISH'
  });
  
  logs.push({
    id: 'LOG-5005',
    userId: 'U-1006',
    userName: 'Admin Root',
    userAvatar: getUser('U-1006')?.avatarUrl,
    department: 'IT Bo\'limi',
    timestamp: format(now, "HH:mm:ss"),
    checkIn: '09:00',
    checkOut: null,
    status: AttendanceStatus.PRESENT,
    confidenceScore: 0.97,
    livenessVerified: true,
    nodeId: 'CAM-03-LAB'
  });

  return logs;
};

export const mockLogs = generateLogs();

export const getSystemStats = () => ({
  totalUsers: mockUsers.length,
  presentToday: 118,
  lateToday: 12,
  absentToday: 12,
  securityAlerts: 3
});
