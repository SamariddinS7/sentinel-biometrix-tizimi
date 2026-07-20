# pyrefly: ignore [missing-import]
import cv2
import time

USERNAME = "admin"
PASSWORD = "12345"
IP = "192.168.1.64"

RTSP = f"rtsp://{USERNAME}:{PASSWORD}@{IP}:554/Streaming/Channels/101"

while True:

    cap = cv2.VideoCapture(RTSP, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        print("Camera topilmadi...")
        time.sleep(3)
        continue

    print("Camera connected.")

    while True:

        ret, frame = cap.read()

        if not ret:
            print("Connection lost...")
            break

        cv2.imshow("Hikvision Live", frame)

        key = cv2.waitKey(1)

        if key == ord('q'):
            cap.release()
            cv2.destroyAllWindows()
            exit()

    cap.release()