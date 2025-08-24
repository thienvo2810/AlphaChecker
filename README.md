# AlphaChecker - Binance Alpha Token Tracker

## Mô tả
AlphaChecker là một ứng dụng theo dõi các token alpha trên Binance, cung cấp thông tin chi tiết về:
- **Tổng cung (Total Supply)**
- **Giá hiện tại (Current Price)**
- **FDV (Fully Diluted Valuation)**
- **Market Cap**
- **Trạng thái Futures Listing**

## Tính năng chính
- 🔍 Theo dõi real-time các token alpha
- 📊 Hiển thị thông tin chi tiết về token
- ⏰ Cập nhật dữ liệu tự động
- 🌐 WebSocket cho dữ liệu real-time
- 📱 Giao diện web responsive
- 🔗 Tích hợp với Binance Alpha API
- 📋 Quản lý danh sách Alpha tokens
- 🎯 Hỗ trợ nhiều blockchain networks
- 📈 **Futures Only Mode**: Chỉ hiển thị các token đã được list futures
- 🎯 Theo dõi futures data (funding rate, open interest)

## Cài đặt

### Yêu cầu hệ thống
- Node.js >= 16.0.0
- npm hoặc yarn

### Cài đặt dependencies
```bash
npm install
```

### Cấu hình môi trường
Tạo file `.env` trong thư mục gốc:
```env
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET_KEY=your_secret_key_here
PORT=3000
NODE_ENV=development
```

### Chạy ứng dụng
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Cấu trúc dự án
```
AlphaChecker/
├── src/
│   ├── index.js          # Entry point
│   ├── config/           # Cấu hình
│   ├── services/         # Business logic
│   ├── routes/           # API routes
│   ├── models/           # Data models
│   └── utils/            # Utility functions
├── public/               # Static files
├── database/             # Database files
└── docs/                 # Documentation
```

## API Endpoints

### GET /api/tokens
Lấy danh sách tất cả token alpha

**Query Parameters:**
- `futures_only=true`: Chỉ lấy các token đã được list futures

### GET /api/tokens/:symbol
Lấy thông tin chi tiết của một token

### GET /api/tokens/:symbol/price
Lấy giá hiện tại của token

### GET /api/tokens/:symbol/futures
Kiểm tra trạng thái futures listing

### GET /api/tokens/:symbol/futures/funding-rate
Lấy funding rate của futures

### GET /api/tokens/:symbol/futures/open-interest
Lấy open interest của futures

### GET /api/tokens/futures/positions
Lấy thông tin positions futures (yêu cầu xác thực)

### GET /api/tokens/futures/account
Lấy thông tin tài khoản futures (yêu cầu xác thực)

### GET /api/tokens/alpha/list
Lấy danh sách tất cả Alpha tokens từ Binance Alpha API

### GET /api/tokens/pairs/usdt
Lấy danh sách tất cả cặp giao dịch USDT

## Đóng góp
Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

## License
MIT License 