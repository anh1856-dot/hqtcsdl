/* =====================================================================
   MushroomFarmDB
   03_procedures_triggers.sql : Stored procedure va Trigger
   Ma loi tu dinh nghia: 50001 - 50099 (backend bat theo ERROR_NUMBER)
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE MushroomFarmDB;
GO

/* =====================================================================
   HAM HO TRO
   ===================================================================== */

-- Tra ve ten vai tro neu user ton tai, dang hoat dong; NULL neu khong hop le
CREATE OR ALTER FUNCTION dbo.fn_GetActiveUserRole (@UserId INT)
RETURNS VARCHAR(20)
AS
BEGIN
    RETURN (SELECT r.RoleName
            FROM dbo.Users u
            JOIN dbo.Roles r ON r.RoleId = u.RoleId
            WHERE u.UserId = @UserId AND u.Status = 'Active' AND u.IsDeleted = 0);
END;
GO

-- Khach dang thue khay (NULL neu khay khong co don thue hieu luc)
CREATE OR ALTER FUNCTION dbo.fn_GetTrayRenter (@TrayId INT)
RETURNS INT
AS
BEGIN
    RETURN (SELECT rn.CustomerId
            FROM dbo.RentalTrays rt
            JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
            WHERE rt.TrayId = @TrayId AND rt.IsActive = 1);
END;
GO

/* =====================================================================
   1. CHO THUE
   ===================================================================== */

-- UC16: Khach tu thue 1 hoac nhieu khay online. He thong tu chon khay trong,
-- tao don thue + thanh toan (gia lap) trong 1 transaction.
CREATE OR ALTER PROCEDURE dbo.usp_RentTrays
    @CustomerId     INT,
    @PackageId      INT,
    @TrayCount      INT = 1,
    @RoomId         INT = NULL,          -- NULL = phong nao cung duoc
    @MushroomTypeId INT = NULL,          -- NULL = loai nao cung duoc
    @PaymentMethod  VARCHAR(20) = 'EWallet',
    @RentalId       INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Msg NVARCHAR(400);

    IF ISNULL(dbo.fn_GetActiveUserRole(@CustomerId), '') <> 'Customer'
        THROW 50001, N'Khách hàng không tồn tại hoặc tài khoản đã bị khóa.', 1;

    DECLARE @Duration INT, @Price DECIMAL(12,0), @MaxTrays INT;
    SELECT @Duration = DurationDays, @Price = PricePerTray, @MaxTrays = MaxTrays
    FROM dbo.RentalPackages
    WHERE PackageId = @PackageId AND IsActive = 1;

    IF @Duration IS NULL
        THROW 50002, N'Gói thuê không tồn tại hoặc đã ngừng áp dụng.', 1;

    IF @TrayCount < 1 OR @TrayCount > @MaxTrays
    BEGIN
        SET @Msg = CONCAT(N'Số khay phải từ 1 đến ', @MaxTrays, N' với gói này.');
        THROW 50003, @Msg, 1;
    END;

    -- BR14: khach chon loai nam co thoi gian sinh truong dai hon goi -> bao loi ro rang
    DECLARE @Growth INT = (SELECT GrowthDays FROM dbo.MushroomTypes WHERE MushroomTypeId = @MushroomTypeId);
    IF @Growth > @Duration
    BEGIN
        SET @Msg = CONCAT(N'Gói thuê quá ngắn cho loại nấm này (cần ', @Growth,
                          N' ngày, gói chỉ có ', @Duration, N' ngày). Hãy chọn gói dài hơn.');
        THROW 50009, @Msg, 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Khoa cac khay duoc chon de 2 khach thue cung luc khong lay trung khay.
        -- BR14: chi lay khay co loai nam kip thu hoach trong thoi han goi
        -- (khay chua gan loai nam thi loai nam chon luc bat dau trong).
        DECLARE @Picked TABLE (TrayId INT PRIMARY KEY);
        INSERT INTO @Picked (TrayId)
        SELECT TOP (@TrayCount) t.TrayId
        FROM dbo.Trays t WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.Rooms r ON r.RoomId = t.RoomId
        LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
        WHERE t.Status = 'Available'
          AND r.Status = 'Active'
          AND (@RoomId IS NULL OR t.RoomId = @RoomId)
          AND (@MushroomTypeId IS NULL OR t.MushroomTypeId = @MushroomTypeId)
          AND (mt.GrowthDays IS NULL OR mt.GrowthDays <= @Duration)
        ORDER BY t.RoomId, t.TrayId;

        IF (SELECT COUNT(*) FROM @Picked) < @TrayCount
        BEGIN
            -- Phan biet "het khay" voi "con khay nhung loai nam qua dai so voi goi"
            DECLARE @AnyFree INT = (SELECT COUNT(*)
                                    FROM dbo.Trays t
                                    JOIN dbo.Rooms r ON r.RoomId = t.RoomId
                                    WHERE t.Status = 'Available' AND r.Status = 'Active'
                                      AND (@RoomId IS NULL OR t.RoomId = @RoomId)
                                      AND (@MushroomTypeId IS NULL OR t.MushroomTypeId = @MushroomTypeId));
            IF @AnyFree >= @TrayCount
            BEGIN
                SET @Msg = CONCAT(N'Gói thuê ', @Duration, N' ngày quá ngắn cho loại nấm của các khay còn trống ',
                                  N'(chỉ ', (SELECT COUNT(*) FROM @Picked), N' khay phù hợp). Hãy chọn gói dài hơn.');
                THROW 50009, @Msg, 1;
            END;
            SET @Msg = CONCAT(N'Không đủ khay trống. Yêu cầu ', @TrayCount,
                              N', còn ', (SELECT COUNT(*) FROM @Picked), N'.');
            THROW 50004, @Msg, 1;
        END;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        DECLARE @Total DECIMAL(14,0) = @Price * @TrayCount;

        INSERT INTO dbo.Rentals (CustomerId, PackageId, StartDate, EndDate, TrayCount, TotalAmount, Status)
        VALUES (@CustomerId, @PackageId, @Today, DATEADD(DAY, @Duration, @Today), @TrayCount, @Total, 'Active');
        SET @RentalId = SCOPE_IDENTITY();

        -- Thue online: khay lien ket voi tai khoan ngay
        INSERT INTO dbo.RentalTrays (RentalId, TrayId, IsLinked, LinkedAt)
        SELECT @RentalId, TrayId, 1, SYSDATETIME() FROM @Picked;

        UPDATE t SET Status = 'Rented', UpdatedAt = SYSDATETIME()
        FROM dbo.Trays t JOIN @Picked p ON p.TrayId = t.TrayId;

        -- Thanh toan gia lap: thanh cong ngay
        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Total, @PaymentMethod, 'Paid',
                CONCAT('SIM', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
        VALUES (@CustomerId, 'Rental', N'Thuê khay thành công',
                CONCAT(N'Bạn đã thuê ', @TrayCount, N' khay, đơn #', @RentalId,
                       N'. Tổng tiền: ', FORMAT(@Total, 'N0'), N' đ.'));

        COMMIT TRANSACTION;

        SELECT t.TrayId, t.TrayCode, r.RoomName
        FROM @Picked p
        JOIN dbo.Trays t ON t.TrayId = p.TrayId
        JOIN dbo.Rooms r ON r.RoomId = t.RoomId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- UC19: Operator gan 1 khay cu the cho khach (thue tai trai).
-- Khay chua lien ket: khach phai nhap ma khay tren app (usp_LinkTrayByCode).
CREATE OR ALTER PROCEDURE dbo.usp_AssignTrayToCustomer
    @OperatorId    INT,
    @CustomerId    INT,
    @PackageId     INT,
    @TrayCode      VARCHAR(20),
    @PaymentMethod VARCHAR(20) = 'Cash',
    @RentalId      INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền gán khay.', 1;

    IF ISNULL(dbo.fn_GetActiveUserRole(@CustomerId), '') <> 'Customer'
        THROW 50001, N'Khách hàng không tồn tại hoặc tài khoản đã bị khóa.', 1;

    DECLARE @Duration INT, @Price DECIMAL(12,0);
    SELECT @Duration = DurationDays, @Price = PricePerTray
    FROM dbo.RentalPackages WHERE PackageId = @PackageId AND IsActive = 1;
    IF @Duration IS NULL
        THROW 50002, N'Gói thuê không tồn tại hoặc đã ngừng áp dụng.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @TrayId INT, @TrayStatus VARCHAR(20), @Growth INT, @Msg NVARCHAR(400);
        SELECT @TrayId = t.TrayId, @TrayStatus = t.Status, @Growth = mt.GrowthDays
        FROM dbo.Trays t WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
        WHERE t.TrayCode = @TrayCode;

        IF @TrayId IS NULL
            THROW 50005, N'Mã khay không tồn tại.', 1;
        IF @TrayStatus <> 'Available'
            THROW 50006, N'Khay không ở trạng thái sẵn sàng cho thuê.', 1;
        -- BR14: loai nam cua khay phai kip thu hoach trong thoi han goi
        IF @Growth > @Duration
        BEGIN
            SET @Msg = CONCAT(N'Gói thuê quá ngắn cho loại nấm của khay này (cần ', @Growth,
                              N' ngày, gói chỉ có ', @Duration, N' ngày). Hãy chọn gói dài hơn.');
            THROW 50009, @Msg, 1;
        END;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);

        INSERT INTO dbo.Rentals (CustomerId, PackageId, CreatedBy, StartDate, EndDate, TrayCount, TotalAmount, Status)
        VALUES (@CustomerId, @PackageId, @OperatorId, @Today, DATEADD(DAY, @Duration, @Today), 1, @Price, 'Active');
        SET @RentalId = SCOPE_IDENTITY();

        INSERT INTO dbo.RentalTrays (RentalId, TrayId, IsLinked) VALUES (@RentalId, @TrayId, 0);

        UPDATE dbo.Trays SET Status = 'Rented', UpdatedAt = SYSDATETIME() WHERE TrayId = @TrayId;

        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Price, @PaymentMethod, 'Paid',
                CONCAT('SIM', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        VALUES (@CustomerId, 'Rental', N'Bạn được gán khay mới',
                CONCAT(N'Khay ', @TrayCode, N' đã được gán cho bạn. Nhập mã khay trong ứng dụng để theo dõi.'),
                @TrayId);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- UC18 / BR09: Khach dang ky khay bang ma. Chi thanh cong khi khay thuoc
-- don thue dang hieu luc cua chinh khach do.
CREATE OR ALTER PROCEDURE dbo.usp_LinkTrayByCode
    @CustomerId INT,
    @TrayCode   VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RentalTrayId INT, @IsLinked BIT, @OwnerId INT;

    SELECT @RentalTrayId = rt.RentalTrayId, @IsLinked = rt.IsLinked, @OwnerId = rn.CustomerId
    FROM dbo.Trays t
    JOIN dbo.RentalTrays rt ON rt.TrayId = t.TrayId AND rt.IsActive = 1
    JOIN dbo.Rentals rn     ON rn.RentalId = rt.RentalId AND rn.Status = 'Active'
    WHERE t.TrayCode = @TrayCode;

    IF NOT EXISTS (SELECT 1 FROM dbo.Trays WHERE TrayCode = @TrayCode)
        THROW 50005, N'Mã khay không tồn tại.', 1;
    IF @RentalTrayId IS NULL OR @OwnerId <> @CustomerId
        THROW 50007, N'Khay này không thuộc đơn thuê của bạn.', 1;
    IF @IsLinked = 1
        THROW 50008, N'Khay đã được liên kết với tài khoản của bạn trước đó.', 1;

    UPDATE dbo.RentalTrays
    SET IsLinked = 1, LinkedAt = SYSDATETIME()
    WHERE RentalTrayId = @RentalTrayId;

    SELECT * FROM dbo.fn_GetCustomerTrays(@CustomerId) WHERE TrayCode = @TrayCode;
END;
GO

-- Scheduler: ket thuc don thue het han.
-- BR14: don con khay dang trong / cho thu hoach thi GIU LAI den khi thu hoach xong,
-- khong tinh them phi; bao 1 lan cho khach va nhan vien. Thu hoach xong thi
-- usp_RecordHarvest goi lai procedure nay voi @RentalId de dong don ngay.
--   @RentalId = NULL : xu ly tat ca don (scheduler)
--   @Silent   = 1    : khong tra ket qua SELECT (khi duoc goi tu procedure khac)
CREATE OR ALTER PROCEDURE dbo.usp_CompleteExpiredRentals
    @RentalId INT = NULL,
    @Silent   BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Done TABLE (RentalId INT PRIMARY KEY, CustomerId INT);
    DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);

    BEGIN TRANSACTION;

    -- 1) Don qua han nhung con khay dang trong: bao 1 lan (khong dong don)
    DECLARE @Overdue TABLE (RentalId INT PRIMARY KEY, CustomerId INT, EndDate DATE);
    INSERT INTO @Overdue (RentalId, CustomerId, EndDate)
    SELECT rn.RentalId, rn.CustomerId, rn.EndDate
    FROM dbo.Rentals rn WITH (UPDLOCK)
    WHERE rn.Status = 'Active'
      AND rn.EndDate < @Today
      AND (@RentalId IS NULL OR rn.RentalId = @RentalId)
      AND EXISTS (SELECT 1
                  FROM dbo.RentalTrays rt
                  JOIN dbo.Trays t ON t.TrayId = rt.TrayId
                  WHERE rt.RentalId = rn.RentalId AND rt.IsActive = 1
                    AND t.Status IN ('Growing', 'ReadyToHarvest'))
      -- Da bao roi thi thoi (kiem tra ca thong bao cua khach lan cua nhan vien,
      -- vi khach co the tat loai thong bao Rental)
      AND NOT EXISTS (SELECT 1 FROM dbo.Notifications n
                      WHERE n.Type = 'Rental'
                        AND (n.Content LIKE CONCAT(N'Đơn thuê #', rn.RentalId, N' đã đến hạn%')
                          OR n.Content LIKE CONCAT(N'Đơn thuê #', rn.RentalId, N' đã quá hạn%')));

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
    SELECT o.CustomerId, 'Rental', N'Đơn thuê đã đến hạn',
           CONCAT(N'Đơn thuê #', o.RentalId, N' đã đến hạn ngày ', FORMAT(o.EndDate, 'dd/MM/yyyy'),
                  N'. Khay vẫn đang trồng nên đơn được giữ đến khi thu hoạch xong, không tính thêm phí.')
    FROM @Overdue o
    UNION ALL
    SELECT u.UserId, 'Rental', N'Đơn thuê quá hạn đang chờ thu hoạch',
           CONCAT(N'Đơn thuê #', o.RentalId, N' đã quá hạn (', FORMAT(o.EndDate, 'dd/MM/yyyy'),
                  N') nhưng còn khay đang trồng. Đơn sẽ tự đóng sau khi thu hoạch.')
    FROM @Overdue o
    CROSS JOIN dbo.Users u
    JOIN dbo.Roles ro ON ro.RoleId = u.RoleId
    WHERE ro.RoleName = 'Operator' AND u.Status = 'Active' AND u.IsDeleted = 0;

    -- 2) Dong don het han khong con khay dang trong
    UPDATE rn SET Status = 'Completed'
    OUTPUT inserted.RentalId, inserted.CustomerId INTO @Done
    FROM dbo.Rentals rn
    WHERE rn.Status = 'Active'
      AND rn.EndDate < @Today
      AND (@RentalId IS NULL OR rn.RentalId = @RentalId)
      AND NOT EXISTS (SELECT 1
                      FROM dbo.RentalTrays rt
                      JOIN dbo.Trays t ON t.TrayId = rt.TrayId
                      WHERE rt.RentalId = rn.RentalId AND rt.IsActive = 1
                        AND t.Status IN ('Growing', 'ReadyToHarvest'));

    -- Tra khay ve trang thai bao tri (ve sinh) truoc khi cho thue lai
    UPDATE t SET Status = 'Maintenance', Stage = NULL, PlantedDate = NULL,
                 ExpectedHarvestDate = NULL, UpdatedAt = SYSDATETIME()
    FROM dbo.Trays t
    JOIN dbo.RentalTrays rt ON rt.TrayId = t.TrayId AND rt.IsActive = 1
    JOIN @Done d ON d.RentalId = rt.RentalId;

    UPDATE rt SET IsActive = 0
    FROM dbo.RentalTrays rt JOIN @Done d ON d.RentalId = rt.RentalId;

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
    SELECT CustomerId, 'Rental', N'Đơn thuê đã kết thúc',
           CONCAT(N'Đơn thuê #', RentalId, N' đã hết hạn và được đóng.')
    FROM @Done;

    COMMIT TRANSACTION;

    IF @Silent = 0
        SELECT RentalId, CustomerId FROM @Done;
END;
GO

-- UC22 / BR14: Gia han don thue co tra phi (khach tu gia han hoac nhan vien gia han ho).
-- Gia han them @Terms ky theo goi cua don, gia = gia hien tai cua goi x so khay x so ky.
-- Don da qua han (dang duoc giu cho thu hoach) thi tinh tu hom nay, khong thu tien nhung ngay da giu.
CREATE OR ALTER PROCEDURE dbo.usp_ExtendRental
    @RentalId      INT,
    @ActorId       INT,
    @Terms         INT = 1,
    @PaymentMethod VARCHAR(20) = 'EWallet',
    @NewEndDate    DATE = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Role VARCHAR(20) = dbo.fn_GetActiveUserRole(@ActorId);
    IF @Role IS NULL
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;
    IF @Terms IS NULL OR @Terms < 1 OR @Terms > 12
        THROW 50052, N'Số kỳ gia hạn phải từ 1 đến 12.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Khoa dong don thue: tranh 2 lan gia han cung luc hoac scheduler dong don giua chung
        DECLARE @CustomerId INT, @Status VARCHAR(20), @EndDate DATE, @TrayCount INT,
                @PackageId INT, @Duration INT, @Price DECIMAL(12,0), @PkgActive BIT;
        SELECT @CustomerId = rn.CustomerId, @Status = rn.Status, @EndDate = rn.EndDate,
               @TrayCount = rn.TrayCount, @PackageId = rn.PackageId,
               @Duration = pk.DurationDays, @Price = pk.PricePerTray, @PkgActive = pk.IsActive
        FROM dbo.Rentals rn WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.RentalPackages pk ON pk.PackageId = rn.PackageId
        WHERE rn.RentalId = @RentalId;

        IF @CustomerId IS NULL
            THROW 50050, N'Không tìm thấy đơn thuê.', 1;
        IF @Role = 'Customer' AND @CustomerId <> @ActorId
            THROW 50010, N'Đơn thuê này không phải của bạn.', 1;
        IF @Status <> 'Active'
            THROW 50051, N'Chỉ gia hạn được đơn thuê đang hoạt động.', 1;
        IF @PkgActive = 0
            THROW 50002, N'Gói thuê của đơn đã ngừng áp dụng, không gia hạn được.', 1;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        DECLARE @Days INT = @Duration * @Terms;
        DECLARE @Amount DECIMAL(14,0) = @Price * @TrayCount * @Terms;
        SET @NewEndDate = DATEADD(DAY, @Days, CASE WHEN @EndDate < @Today THEN @Today ELSE @EndDate END);

        UPDATE dbo.Rentals
        SET EndDate = @NewEndDate, TotalAmount = TotalAmount + @Amount
        WHERE RentalId = @RentalId;

        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Amount, @PaymentMethod, 'Paid',
                CONCAT('EXT', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
        VALUES (@CustomerId, 'Rental', N'Gia hạn đơn thuê thành công',
                CONCAT(N'Đơn thuê #', @RentalId, N' được gia hạn thêm ', @Days, N' ngày, đến ',
                       FORMAT(@NewEndDate, 'dd/MM/yyyy'), N'. Số tiền: ', FORMAT(@Amount, 'N0'), N' đ.'));

        COMMIT TRANSACTION;

        SELECT @RentalId AS RentalId, @NewEndDate AS EndDate, @Days AS ExtendedDays, @Amount AS Amount;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =====================================================================
   2. CANH TAC, THU HOACH, GIAO NHAN
   ===================================================================== */

-- Bat dau vu trong tren khay (khay trong hoac khay vua duoc thue)
CREATE OR ALTER PROCEDURE dbo.usp_StartCultivation
    @TrayId         INT,
    @MushroomTypeId INT,
    @OperatorId     INT,
    @Note           NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.MushroomTypes WHERE MushroomTypeId = @MushroomTypeId)
        THROW 50011, N'Loại nấm không tồn tại.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Trays WHERE TrayId = @TrayId AND Status IN ('Available', 'Rented'))
        THROW 50012, N'Khay không tồn tại hoặc không ở trạng thái có thể bắt đầu trồng.', 1;

    DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
    DECLARE @Expected DATE = dbo.fn_CalcExpectedHarvestDate(@Today, @MushroomTypeId);
    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);

    BEGIN TRANSACTION;

    UPDATE dbo.Trays
    SET Status = 'Growing', Stage = 'Inoculation', MushroomTypeId = @MushroomTypeId,
        PlantedDate = @Today, ExpectedHarvestDate = @Expected, UpdatedAt = SYSDATETIME()
    WHERE TrayId = @TrayId;

    INSERT INTO dbo.GrowthLogs (TrayId, Stage, Note, LoggedBy)
    VALUES (@TrayId, 'Inoculation', ISNULL(@Note, N'Bắt đầu cấy giống'), @OperatorId);

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        SELECT @CustomerId, 'Progress', N'Khay của bạn đã bắt đầu trồng',
               CONCAT(N'Khay ', TrayCode, N' bắt đầu cấy giống. Dự kiến thu hoạch: ',
                      FORMAT(@Expected, 'dd/MM/yyyy'), N'.'),
               @TrayId
        FROM dbo.Trays WHERE TrayId = @TrayId;

    COMMIT TRANSACTION;
END;
GO

-- UC12/UC13: Cap nhat giai doan sinh truong (chi duoc di toi, khong lui).
-- Khi sang giai doan Harvest: khay chuyen ReadyToHarvest va tao lich thu hoach.
CREATE OR ALTER PROCEDURE dbo.usp_UpdateTrayStage
    @TrayId     INT,
    @NewStage   VARCHAR(20),
    @OperatorId INT,
    @Note       NVARCHAR(1000) = NULL,
    @ImageUrl   VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;

    DECLARE @Status VARCHAR(20), @OldStage VARCHAR(20), @TrayCode VARCHAR(20), @Expected DATE;
    SELECT @Status = Status, @OldStage = Stage, @TrayCode = TrayCode, @Expected = ExpectedHarvestDate
    FROM dbo.Trays WHERE TrayId = @TrayId;

    IF @Status IS NULL
        THROW 50005, N'Khay không tồn tại.', 1;
    IF @Status <> 'Growing'
        THROW 50013, N'Chỉ cập nhật giai đoạn cho khay đang trồng.', 1;

    -- Thu tu giai doan (BR06)
    DECLARE @OldOrder INT = CASE @OldStage WHEN 'Inoculation' THEN 1 WHEN 'Incubation' THEN 2
                                           WHEN 'Pinning' THEN 3 WHEN 'Fruiting' THEN 4 WHEN 'Harvest' THEN 5 END;
    DECLARE @NewOrder INT = CASE @NewStage WHEN 'Inoculation' THEN 1 WHEN 'Incubation' THEN 2
                                           WHEN 'Pinning' THEN 3 WHEN 'Fruiting' THEN 4 WHEN 'Harvest' THEN 5 END;
    IF @NewOrder IS NULL
        THROW 50014, N'Giai đoạn không hợp lệ.', 1;
    IF @NewOrder <= @OldOrder
        THROW 50015, N'Giai đoạn mới phải sau giai đoạn hiện tại.', 1;

    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);
    DECLARE @RentalId INT = (SELECT RentalId FROM dbo.RentalTrays WHERE TrayId = @TrayId AND IsActive = 1);
    DECLARE @StageName NVARCHAR(50) = CASE @NewStage WHEN 'Inoculation' THEN N'Cấy giống'
                                                     WHEN 'Incubation'  THEN N'Ủ tơ'
                                                     WHEN 'Pinning'     THEN N'Ra nụ'
                                                     WHEN 'Fruiting'    THEN N'Phát triển quả thể'
                                                     WHEN 'Harvest'     THEN N'Sẵn sàng thu hoạch' END;

    BEGIN TRANSACTION;

    UPDATE dbo.Trays
    SET Stage = @NewStage,
        Status = CASE WHEN @NewStage = 'Harvest' THEN 'ReadyToHarvest' ELSE Status END,
        UpdatedAt = SYSDATETIME()
    WHERE TrayId = @TrayId;

    INSERT INTO dbo.GrowthLogs (TrayId, Stage, Note, ImageUrl, LoggedBy)
    VALUES (@TrayId, @NewStage, @Note, @ImageUrl, @OperatorId);

    IF @NewStage = 'Harvest'
    BEGIN
        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        INSERT INTO dbo.Harvests (TrayId, RentalId, ScheduledDate, Status)
        VALUES (@TrayId, @RentalId,
                CASE WHEN @Expected > @Today THEN @Expected ELSE @Today END, 'Scheduled');
    END;

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        VALUES (@CustomerId,
                CASE WHEN @NewStage = 'Harvest' THEN 'HarvestReady' ELSE 'Progress' END,
                CONCAT(N'Khay ', @TrayCode, N': ', @StageName),
                CONCAT(N'Khay ', @TrayCode, N' đã chuyển sang giai đoạn "', @StageName, N'".',
                       CASE WHEN @Note IS NOT NULL THEN CONCAT(N' Ghi chú: ', @Note) ELSE N'' END),
                @TrayId);

    COMMIT TRANSACTION;
END;
GO

-- UC37: Ghi nhan ket qua thu hoach
CREATE OR ALTER PROCEDURE dbo.usp_RecordHarvest
    @TrayId     INT,
    @WeightKg   DECIMAL(6,2),
    @Quality    VARCHAR(10),
    @OperatorId INT,
    @Note       NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;

    DECLARE @HarvestId INT = (SELECT TOP (1) HarvestId FROM dbo.Harvests
                              WHERE TrayId = @TrayId AND Status = 'Scheduled'
                              ORDER BY ScheduledDate);
    IF @HarvestId IS NULL
        THROW 50016, N'Khay chưa có lịch thu hoạch.', 1;
    IF @WeightKg IS NULL OR @WeightKg < 0
        THROW 50017, N'Khối lượng thu hoạch không hợp lệ.', 1;

    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);

    BEGIN TRANSACTION;

    UPDATE dbo.Harvests
    SET Status = 'Completed', HarvestedAt = SYSDATETIME(), WeightKg = @WeightKg,
        Quality = @Quality, RecordedBy = @OperatorId, Note = @Note
    WHERE HarvestId = @HarvestId;

    UPDATE dbo.Trays SET Status = 'Harvested', UpdatedAt = SYSDATETIME() WHERE TrayId = @TrayId;

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        SELECT @CustomerId, 'HarvestReady', N'Đã thu hoạch nấm của bạn',
               CONCAT(N'Khay ', TrayCode, N' thu hoạch được ', @WeightKg,
                      N' kg. Hãy chọn nhận tại trại hoặc giao tận nơi.'),
               @TrayId
        FROM dbo.Trays WHERE TrayId = @TrayId;

    -- BR14: don da qua han (dang giu cho thu hoach) -> dong ngay neu khong con khay nao dang trong
    DECLARE @RentalId INT = (SELECT rt.RentalId
                             FROM dbo.RentalTrays rt
                             JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
                             WHERE rt.TrayId = @TrayId AND rt.IsActive = 1
                               AND rn.Status = 'Active' AND rn.EndDate < CAST(SYSDATETIME() AS DATE));
    IF @RentalId IS NOT NULL
        EXEC dbo.usp_CompleteExpiredRentals @RentalId = @RentalId, @Silent = 1;

    COMMIT TRANSACTION;

    SELECT @HarvestId AS HarvestId;
END;
GO

-- UC38: Khach yeu cau nhan nam tai trai hoac giao tan noi
CREATE OR ALTER PROCEDURE dbo.usp_RequestDelivery
    @CustomerId    INT,
    @HarvestId     INT,
    @RequestType   VARCHAR(10),
    @Address       NVARCHAR(255) = NULL,
    @ReceiverPhone VARCHAR(15) = NULL,
    @PreferredDate DATE = NULL,
    @RequestId     INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1
                   FROM dbo.Harvests h
                   JOIN dbo.Rentals rn ON rn.RentalId = h.RentalId
                   WHERE h.HarvestId = @HarvestId AND h.Status = 'Completed'
                     AND rn.CustomerId = @CustomerId)
        THROW 50020, N'Không tìm thấy đợt thu hoạch của bạn.', 1;

    IF EXISTS (SELECT 1 FROM dbo.DeliveryRequests
               WHERE HarvestId = @HarvestId AND Status <> 'Cancelled')
        THROW 50021, N'Đợt thu hoạch này đã có yêu cầu giao nhận.', 1;

    IF @RequestType = 'Delivery' AND @Address IS NULL
        SELECT @Address = Address FROM dbo.Users WHERE UserId = @CustomerId;

    INSERT INTO dbo.DeliveryRequests (HarvestId, CustomerId, RequestType, Address, ReceiverPhone, PreferredDate, Fee)
    VALUES (@HarvestId, @CustomerId, @RequestType, @Address,
            ISNULL(@ReceiverPhone, (SELECT Phone FROM dbo.Users WHERE UserId = @CustomerId)),
            @PreferredDate,
            CASE WHEN @RequestType = 'Delivery' THEN 30000 ELSE 0 END);
    SET @RequestId = SCOPE_IDENTITY();
END;
GO

/* =====================================================================
   3. IOT
   ===================================================================== */

-- UC24: API nhan du lieu tu thiet bi (that hoac gia lap) goi procedure nay
CREATE OR ALTER PROCEDURE dbo.usp_InsertSensorReading
    @DeviceCode  VARCHAR(20),
    @Temperature DECIMAL(5,2) = NULL,
    @Humidity    DECIMAL(5,2) = NULL,
    @CO2         DECIMAL(7,1) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DeviceId INT, @RoomId INT;
    SELECT @DeviceId = DeviceId, @RoomId = RoomId
    FROM dbo.Devices WHERE DeviceCode = @DeviceCode AND DeviceType = 'Sensor';

    IF @DeviceId IS NULL
        THROW 50030, N'Thiết bị cảm biến không tồn tại.', 1;

    UPDATE dbo.Devices SET LastSeenAt = SYSDATETIME(), Status = 'Online' WHERE DeviceId = @DeviceId;

    INSERT INTO dbo.SensorReadings (DeviceId, RoomId, Temperature, Humidity, CO2)
    VALUES (@DeviceId, @RoomId, @Temperature, @Humidity, @CO2);

    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS ReadingId;
END;
GO

-- Gia lap IoT: sinh du lieu cho moi cam bien dang online.
-- @Rounds lan do, cach nhau @IntervalMinutes (lui ve qua khu de tao lich su).
-- @AnomalyPercent: ti le % moi chi so bi vuot nguong (de test canh bao).
CREATE OR ALTER PROCEDURE dbo.usp_SimulateSensorData
    @Rounds          INT = 1,
    @IntervalMinutes INT = 5,
    @AnomalyPercent  INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @i INT = @Rounds - 1;
    WHILE @i >= 0
    BEGIN
        DECLARE @At DATETIME2(0) = DATEADD(MINUTE, -@i * @IntervalMinutes, SYSDATETIME());

        -- Moi lan do la 1 lenh INSERT rieng de trigger xu ly theo dung thu tu thoi gian
        INSERT INTO dbo.SensorReadings (DeviceId, RoomId, Temperature, Humidity, CO2, RecordedAt)
        SELECT d.DeviceId, d.RoomId,
               CAST(v.T AS DECIMAL(5,2)),
               CAST(CASE WHEN v.H > 100 THEN 100 WHEN v.H < 0 THEN 0 ELSE v.H END AS DECIMAL(5,2)),
               CAST(CASE WHEN v.C < 0 THEN 0 ELSE v.C END AS DECIMAL(7,1)),
               @At
        FROM dbo.Devices d
        LEFT JOIN dbo.EnvThresholds tT ON tT.RoomId = d.RoomId AND tT.Metric = 'Temperature'
        LEFT JOIN dbo.EnvThresholds tH ON tH.RoomId = d.RoomId AND tH.Metric = 'Humidity'
        LEFT JOIN dbo.EnvThresholds tC ON tC.RoomId = d.RoomId AND tC.Metric = 'CO2'
        -- Nguong mac dinh neu phong chua cau hinh
        CROSS APPLY (SELECT ISNULL(tT.MinValue, 18)  AS TMin, ISNULL(tT.MaxValue, 26)   AS TMax,
                            ISNULL(tH.MinValue, 80)  AS HMin, ISNULL(tH.MaxValue, 95)   AS HMax,
                            ISNULL(tC.MinValue, 400) AS CMin, ISNULL(tC.MaxValue, 1000) AS CMax) th
        -- So ngau nhien rieng cho tung dong
        CROSS APPLY (SELECT RAND(CHECKSUM(NEWID())) AS rT, RAND(CHECKSUM(NEWID())) AS rH, RAND(CHECKSUM(NEWID())) AS rC,
                            ABS(CHECKSUM(NEWID())) % 100 AS aT, ABS(CHECKSUM(NEWID())) % 100 AS aH,
                            ABS(CHECKSUM(NEWID())) % 100 AS aC) rnd
        -- Binh thuong: nam trong 15%-85% khoang nguong. Bat thuong: vuot 10%-40% khoang nguong
        CROSS APPLY (SELECT
            CASE WHEN rnd.aT >= @AnomalyPercent THEN th.TMin + (th.TMax - th.TMin) * (0.15 + 0.7 * rnd.rT)
                 WHEN rnd.rT < 0.5 THEN th.TMin - (th.TMax - th.TMin) * (0.1 + 0.6 * rnd.rT)
                 ELSE th.TMax + (th.TMax - th.TMin) * (0.1 + 0.6 * (rnd.rT - 0.5)) END AS T,
            CASE WHEN rnd.aH >= @AnomalyPercent THEN th.HMin + (th.HMax - th.HMin) * (0.15 + 0.7 * rnd.rH)
                 WHEN rnd.rH < 0.5 THEN th.HMin - (th.HMax - th.HMin) * (0.1 + 0.6 * rnd.rH)
                 ELSE th.HMax + (th.HMax - th.HMin) * (0.1 + 0.6 * (rnd.rH - 0.5)) END AS H,
            CASE WHEN rnd.aC >= @AnomalyPercent THEN th.CMin + (th.CMax - th.CMin) * (0.15 + 0.7 * rnd.rC)
                 ELSE th.CMax + (th.CMax - th.CMin) * (0.1 + 0.3 * rnd.rC) END AS C   -- CO2 chi bat thuong khi cao
        ) v
        WHERE d.DeviceType = 'Sensor' AND d.Status <> 'Offline';

        SET @i -= 1;
    END;

    UPDATE dbo.Devices SET LastSeenAt = SYSDATETIME()
    WHERE DeviceType = 'Sensor' AND Status <> 'Offline';
END;
GO

-- UC27: Operator bat/tat thiet bi thu cong (tat che do tu dong cua thiet bi do)
CREATE OR ALTER PROCEDURE dbo.usp_ControlDevice
    @DeviceId INT,
    @Command  VARCHAR(10),
    @UserId   INT,
    @Reason   NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@UserId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền điều khiển thiết bị.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices
                   WHERE DeviceId = @DeviceId AND DeviceType IN ('MistSprayer', 'Fan', 'Heater', 'GrowLight'))
        THROW 50031, N'Thiết bị không tồn tại hoặc không điều khiển được.', 1;
    IF @Command NOT IN ('ON', 'OFF')
        THROW 50032, N'Lệnh không hợp lệ (ON/OFF).', 1;

    BEGIN TRANSACTION;
    UPDATE dbo.Devices SET AutoMode = 0 WHERE DeviceId = @DeviceId;
    INSERT INTO dbo.DeviceCommands (DeviceId, Command, Source, IssuedBy, Reason)
    VALUES (@DeviceId, @Command, 'Manual', @UserId, @Reason);
    COMMIT TRANSACTION;
END;
GO

-- UC33: Xac nhan / xu ly canh bao
CREATE OR ALTER PROCEDURE dbo.usp_UpdateAlertStatus
    @AlertId INT,
    @Status  VARCHAR(15),
    @UserId  INT
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@UserId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền xử lý cảnh báo.', 1;
    IF @Status NOT IN ('Acknowledged', 'Resolved')
        THROW 50033, N'Trạng thái không hợp lệ.', 1;

    UPDATE dbo.Alerts
    SET Status = @Status,
        ResolvedBy = @UserId,
        ResolvedAt = CASE WHEN @Status = 'Resolved' THEN SYSDATETIME() ELSE ResolvedAt END
    WHERE AlertId = @AlertId AND Status <> 'Resolved';

    IF @@ROWCOUNT = 0
        THROW 50034, N'Cảnh báo không tồn tại hoặc đã được xử lý.', 1;
END;
GO

-- UC35: Admin bat/tat 1 loai thong bao cho toan he thong
CREATE OR ALTER PROCEDURE dbo.usp_SetNotificationSetting
    @Type      VARCHAR(20),
    @IsEnabled BIT,
    @AdminId   INT
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@AdminId), '') <> 'Admin'
        THROW 50010, N'Chỉ Admin được cấu hình thông báo.', 1;

    UPDATE dbo.NotificationSettings
    SET IsEnabled = @IsEnabled, UpdatedBy = @AdminId, UpdatedAt = SYSDATETIME()
    WHERE Type = @Type;

    IF @@ROWCOUNT = 0
        THROW 50035, N'Loại thông báo không tồn tại.', 1;
END;
GO

-- Nguoi dung tu bat/tat 1 loai thong bao cho rieng minh
CREATE OR ALTER PROCEDURE dbo.usp_SetUserNotificationPref
    @UserId    INT,
    @Type      VARCHAR(20),
    @IsEnabled BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.fn_GetActiveUserRole(@UserId) IS NULL
        THROW 50001, N'Tài khoản không tồn tại hoặc đã bị khóa.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.NotificationSettings WHERE Type = @Type)
        THROW 50035, N'Loại thông báo không tồn tại.', 1;

    MERGE dbo.UserNotificationPrefs AS t
    USING (SELECT @UserId AS UserId, @Type AS Type) AS s
       ON t.UserId = s.UserId AND t.Type = s.Type
    WHEN MATCHED THEN
        UPDATE SET IsEnabled = @IsEnabled, UpdatedAt = SYSDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (UserId, Type, IsEnabled) VALUES (@UserId, @Type, @IsEnabled);
END;
GO

/* =====================================================================
   4. BAO CAO
   ===================================================================== */

-- UC41: Doanh thu theo goi thue trong khoang thoi gian
CREATE OR ALTER PROCEDURE dbo.usp_RevenueReport
    @FromDate DATE,
    @ToDate   DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Moi don co the co nhieu thanh toan (thue + cac lan gia han):
    -- RentalCount/TrayCount chi tinh o thanh toan dau tien cua don, tranh dem trung;
    -- Revenue cong tat ca thanh toan; ExtensionCount = so lan gia han trong ky.
    WITH P AS (
        SELECT p.RentalId, p.Amount, p.PaidAt,
               CASE WHEN p.PaymentId = MIN(p.PaymentId) OVER (PARTITION BY p.RentalId) THEN 1 ELSE 0 END AS IsFirst
        FROM dbo.Payments p
        WHERE p.Status = 'Paid'
    )
    SELECT  pk.PackageId, pk.PackageName,
            SUM(P.IsFirst)                                           AS RentalCount,
            SUM(CASE WHEN P.IsFirst = 1 THEN rn.TrayCount ELSE 0 END) AS TrayCount,
            SUM(1 - P.IsFirst)                                       AS ExtensionCount,
            SUM(P.Amount)                                            AS Revenue
    FROM P
    JOIN dbo.Rentals rn        ON rn.RentalId = P.RentalId
    JOIN dbo.RentalPackages pk ON pk.PackageId = rn.PackageId
    WHERE P.PaidAt >= @FromDate
      AND P.PaidAt <  DATEADD(DAY, 1, @ToDate)
    GROUP BY ROLLUP ((pk.PackageId, pk.PackageName))
    ORDER BY GROUPING(pk.PackageId), Revenue DESC;
END;
GO

/* =====================================================================
   5. TRIGGER
   ===================================================================== */

-- UC28 + UC32 + BR10: Sau khi co du lieu cam bien moi
--   1) So voi nguong -> tao canh bao (khong tao trung neu da co canh bao chua xu ly)
--   2) Chi so tro lai binh thuong -> tu dong dong canh bao
--   3) Gui thong bao cho Admin/Operator va khach co khay trong phong
--   4) Tu dong bat/tat quat, phun suong, suoi (thiet bi o che do Auto)
CREATE OR ALTER TRIGGER dbo.trg_SensorReadings_AfterInsert
ON dbo.SensorReadings
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Chi xet lan do moi nhat cua moi phong trong lo du lieu vua insert
    WITH Latest AS (
        SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.RoomId ORDER BY i.RecordedAt DESC, i.ReadingId DESC) AS rn
        FROM inserted i
    )
    SELECT  l.ReadingId, l.RoomId, m.Metric, m.Value, th.MinValue, th.MaxValue,
            CASE WHEN m.Value < th.MinValue THEN 'Low'
                 WHEN m.Value > th.MaxValue THEN 'High'
                 ELSE 'Normal' END AS State
    INTO #Eval
    FROM Latest l
    CROSS APPLY (VALUES ('Temperature', CAST(l.Temperature AS DECIMAL(7,2))),
                        ('Humidity',    CAST(l.Humidity    AS DECIMAL(7,2))),
                        ('CO2',         CAST(l.CO2         AS DECIMAL(7,2)))) m(Metric, Value)
    JOIN dbo.EnvThresholds th ON th.RoomId = l.RoomId AND th.Metric = m.Metric
    WHERE l.rn = 1 AND m.Value IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM #Eval) RETURN;

    -- 2) Tu dong dong canh bao khi chi so binh thuong tro lai
    UPDATE a SET Status = 'Resolved', ResolvedAt = SYSDATETIME()
    FROM dbo.Alerts a
    JOIN #Eval e ON e.RoomId = a.RoomId AND e.Metric = a.Metric
    WHERE e.State = 'Normal' AND a.Status IN ('Open', 'Acknowledged');

    -- 1) Tao canh bao moi
    DECLARE @NewAlerts TABLE (AlertId INT, RoomId INT, Severity VARCHAR(10), Message NVARCHAR(500));

    INSERT INTO dbo.Alerts (RoomId, ReadingId, Metric, Value, Severity, Message)
    OUTPUT inserted.AlertId, inserted.RoomId, inserted.Severity, inserted.Message INTO @NewAlerts
    SELECT  e.RoomId, e.ReadingId, e.Metric, e.Value,
            CASE WHEN e.Value > e.MaxValue + 0.25 * (e.MaxValue - e.MinValue)
                   OR e.Value < e.MinValue - 0.25 * (e.MaxValue - e.MinValue)
                 THEN 'Critical' ELSE 'Warning' END,
            CONCAT(r.RoomName, N': ', dbo.fn_MetricName(e.Metric),
                   CASE e.State WHEN 'High' THEN N' cao' ELSE N' thấp' END,
                   N' (', CAST(e.Value AS DECIMAL(7,1)), N', ngưỡng ',
                   CAST(e.MinValue AS DECIMAL(7,1)), N' - ', CAST(e.MaxValue AS DECIMAL(7,1)), N')')
    FROM #Eval e
    JOIN dbo.Rooms r ON r.RoomId = e.RoomId
    WHERE e.State <> 'Normal'
      AND NOT EXISTS (SELECT 1 FROM dbo.Alerts a
                      WHERE a.RoomId = e.RoomId AND a.Metric = e.Metric
                        AND a.Status IN ('Open', 'Acknowledged'));

    -- 3) Thong bao
    INSERT INTO dbo.Notifications (UserId, Type, Title, Content, AlertId)
    SELECT  rcp.UserId, 'Alert',
            CASE n.Severity WHEN 'Critical' THEN N'⚠ Cảnh báo nghiêm trọng' ELSE N'Cảnh báo môi trường' END,
            n.Message, n.AlertId
    FROM @NewAlerts n
    CROSS APPLY (
        SELECT u.UserId
        FROM dbo.Users u JOIN dbo.Roles ro ON ro.RoleId = u.RoleId
        WHERE ro.RoleName IN ('Admin', 'Operator') AND u.Status = 'Active' AND u.IsDeleted = 0
        UNION
        SELECT rn.CustomerId
        FROM dbo.RentalTrays rt
        JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
        JOIN dbo.Trays t    ON t.TrayId = rt.TrayId
        WHERE t.RoomId = n.RoomId AND rt.IsActive = 1 AND rt.IsLinked = 1
    ) rcp;

    -- 4) Dieu khien tu dong
    WITH S AS (
        -- ELSE '' + NULLIF de MAX khong gap NULL (tranh warning gui ve backend)
        SELECT RoomId,
               NULLIF(MAX(CASE WHEN Metric = 'Temperature' THEN State ELSE '' END), '') AS T,
               NULLIF(MAX(CASE WHEN Metric = 'Humidity'    THEN State ELSE '' END), '') AS H,
               NULLIF(MAX(CASE WHEN Metric = 'CO2'         THEN State ELSE '' END), '') AS C
        FROM #Eval GROUP BY RoomId
    ),
    Desired AS (
        SELECT d.DeviceId, d.IsOn,
               CASE d.DeviceType
                   WHEN 'MistSprayer' THEN CASE WHEN S.H IS NULL THEN NULL WHEN S.H = 'Low' THEN 1 ELSE 0 END
                   WHEN 'Heater'      THEN CASE WHEN S.T IS NULL THEN NULL WHEN S.T = 'Low' THEN 1 ELSE 0 END
                   WHEN 'Fan'         THEN CASE WHEN 'High' IN (S.T, S.H, S.C) THEN 1
                                                WHEN S.T IS NULL AND S.H IS NULL AND S.C IS NULL THEN NULL
                                                ELSE 0 END
               END AS WantOn,
               CASE d.DeviceType
                   WHEN 'MistSprayer' THEN N'Độ ẩm '
                   WHEN 'Heater'      THEN N'Nhiệt độ '
                   ELSE N'Nhiệt độ/độ ẩm/CO₂ ' END AS Topic
        FROM S JOIN dbo.Devices d ON d.RoomId = S.RoomId
        WHERE d.AutoMode = 1 AND d.Status = 'Online'
          AND d.DeviceType IN ('MistSprayer', 'Heater', 'Fan')
    )
    INSERT INTO dbo.DeviceCommands (DeviceId, Command, Source, Reason)
    SELECT DeviceId,
           CASE WantOn WHEN 1 THEN 'ON' ELSE 'OFF' END,
           'Auto',
           CONCAT(N'Tự động: ', Topic, CASE WantOn WHEN 1 THEN N'vượt ngưỡng' ELSE N'đã ổn định' END)
    FROM Desired
    WHERE WantOn IS NOT NULL AND WantOn <> IsOn;
END;
GO

-- Cap nhat trang thai bat/tat cua thiet bi theo lenh moi nhat.
-- Thiet bi gia lap coi nhu thuc thi ngay.
CREATE OR ALTER TRIGGER dbo.trg_DeviceCommands_AfterInsert
ON dbo.DeviceCommands
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    WITH LastCmd AS (
        SELECT i.DeviceId, i.Command,
               ROW_NUMBER() OVER (PARTITION BY i.DeviceId ORDER BY i.CreatedAt DESC, i.CommandId DESC) AS rn
        FROM inserted i
    )
    UPDATE d SET IsOn = CASE lc.Command WHEN 'ON' THEN 1 ELSE 0 END
    FROM dbo.Devices d JOIN LastCmd lc ON lc.DeviceId = d.DeviceId AND lc.rn = 1;

    UPDATE c SET Status = 'Executed'
    FROM dbo.DeviceCommands c
    JOIN inserted i  ON i.CommandId = c.CommandId
    JOIN dbo.Devices d ON d.DeviceId = c.DeviceId
    WHERE d.IsSimulated = 1;
END;
GO

-- UC35: Loc thong bao theo cau hinh truoc khi luu.
--   - Loai bi Admin tat toan he thong: khong gui cho ai
--   - Nguoi dung tu tat loai do: khong gui cho nguoi do
--   - Ngoai le: canh bao moi truong (Alert) luon gui cho Admin/Operator
CREATE OR ALTER TRIGGER dbo.trg_Notifications_InsteadOfInsert
ON dbo.Notifications
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content, AlertId, TrayId, IsRead, CreatedAt)
    SELECT i.UserId, i.Type, i.Title, i.Content, i.AlertId, i.TrayId,
           ISNULL(i.IsRead, 0), ISNULL(i.CreatedAt, SYSDATETIME())
    FROM inserted i
    LEFT JOIN dbo.NotificationSettings s  ON s.Type = i.Type
    LEFT JOIN dbo.UserNotificationPrefs p ON p.UserId = i.UserId AND p.Type = i.Type
    WHERE (i.Type = 'Alert' AND dbo.fn_GetActiveUserRole(i.UserId) IN ('Admin', 'Operator'))
       OR (ISNULL(s.IsEnabled, 1) = 1 AND ISNULL(p.IsEnabled, 1) = 1);
END;
GO

-- BR12: Xoa tai khoan = xoa mem (giu lich su thue, thanh toan)
CREATE OR ALTER TRIGGER dbo.trg_Users_InsteadOfDelete
ON dbo.Users
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u SET IsDeleted = 1, Status = 'Disabled', UpdatedAt = SYSDATETIME()
    FROM dbo.Users u JOIN deleted d ON d.UserId = u.UserId;
END;
GO

-- So khay trong phong khong vuot suc chua
CREATE OR ALTER TRIGGER dbo.trg_Trays_CheckRoomCapacity
ON dbo.Trays
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(RoomId) RETURN;

    IF EXISTS (SELECT 1
               FROM dbo.Rooms r
               WHERE r.RoomId IN (SELECT RoomId FROM inserted)
                 AND (SELECT COUNT(*) FROM dbo.Trays t WHERE t.RoomId = r.RoomId) > r.Capacity)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50040, N'Số khay vượt quá sức chứa của phòng.', 1;
    END;
END;
GO

PRINT N'03_procedures_triggers.sql: xong';
