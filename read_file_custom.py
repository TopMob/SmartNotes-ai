import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python read_file_custom.py <filepath>")
        sys.exit(1)

    filepath = sys.argv[1]
    try:
        with open(filepath, 'r') as file:
            print(file.read())
    except FileNotFoundError:
        print(f"Error: File not found - {filepath}")
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    main()
