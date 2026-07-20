import cv2

ip = input("IP: ")
user = input("Login: ")
password = input("Password: ")

url = f"rtsp://{user}:{password}@{ip}:554/Streaming/Channels/101"

cap = cv2.VideoCapture(url)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    cv2.imshow("Live", frame)
    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()