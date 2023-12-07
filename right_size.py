import os
dir_path = '/Users/vaarnan/dev/IntervalFlow/fastlane/metadata'

def count_chars(file_path):
    with open(file_path) as f:
        return len(f.read())

print(f'{"File Path":<80} {"Number of Characters":<20}')

for root, _, files in os.walk(dir_path):
    for file in files:
        if file == 'keywords.txt':
            file_path = os.path.join(root, file)
            chars_count = count_chars(file_path)
            if chars_count > 100:
                print(f'{file_path:<80} {chars_count:<20}')

for root, _, files in os.walk(dir_path):
    for file in files:
        if file == 'subtitle.txt':
            file_path = os.path.join(root, file)
            chars_count = count_chars(file_path)
            if chars_count > 30:
                print(f'{file_path:<80} {chars_count:<20}')
                text = open(file_path).read()
                print(text)
